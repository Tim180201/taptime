#define _DARWIN_C_SOURCE 1
#define _GNU_SOURCE 1

#include <arpa/inet.h>
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <poll.h>
#include <pthread.h>
#include <signal.h>
#include <spawn.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#if defined(__APPLE__)
#include <sys/mount.h>
#else
#include <sys/vfs.h>
#endif
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

#if defined(__APPLE__)
#include <sys/attr.h>
#include <sys/acl.h>
#else
#include <linux/fs.h>
#include <linux/stat.h>
#include <sys/random.h>
#include <sys/syscall.h>
#include <sys/xattr.h>
#endif

enum {
  CONTROL_FD = 3,
  EVENT_FD = 4,
  SECRET_FD = 5,
  ROOT_FD = 6,
  STAGING_FD = 7,
  BASE_FD = 8,
  PG_CONFIG_FD = 9,
  INITDB_FD = 10,
  POSTGRES_FD = 11,
  CHILD_PASSWORD_FD = 3,
  FRAME_LIMIT = 4096,
  INITDB_BUDGET_MS = 30000,
  POSTGRES_STOP_BUDGET_MS = 30000,
  HEARTBEAT_LEASE_MS = 5000,
  SUPERVISOR_WATCHDOG_MS = 10000
};

static atomic_llong watchdog_deadline_ms;
static atomic_int watchdog_enabled;

typedef struct bound_binary_descriptors {
  struct stat identities[3];
} bound_binary_descriptors;

typedef struct bound_mount_descriptors {
  struct statfs base;
  struct statfs root;
  struct statfs staging;
} bound_mount_descriptors;

static long long monotonic_ms(void) {
  struct timespec value;
  if (clock_gettime(CLOCK_MONOTONIC, &value) != 0) {
    return -1;
  }
  return ((long long)value.tv_sec * 1000LL) + (value.tv_nsec / 1000000LL);
}

static void watchdog_touch(void) {
  long long now = monotonic_ms();
  if (now >= 0) {
    atomic_store(&watchdog_deadline_ms, now + SUPERVISOR_WATCHDOG_MS);
  }
}

static void *watchdog_main(void *unused) {
  (void)unused;
  for (;;) {
    struct timespec pause = {.tv_sec = 0, .tv_nsec = 100000000L};
    (void)nanosleep(&pause, NULL);
    if (atomic_load(&watchdog_enabled) == 0) {
      continue;
    }
    long long deadline = atomic_load(&watchdog_deadline_ms);
    long long now = monotonic_ms();
    if (now < 0 || (deadline > 0 && now > deadline)) {
      (void)kill(getpid(), SIGKILL);
      _exit(124);
    }
  }
}

static int write_all(int fd, const void *buffer, size_t length) {
  const unsigned char *cursor = buffer;
  while (length > 0) {
    ssize_t written = write(fd, cursor, length);
    if (written < 0) {
      if (errno == EINTR) {
        continue;
      }
      return -1;
    }
    cursor += (size_t)written;
    length -= (size_t)written;
  }
  return 0;
}

static int emit_frame(const char *payload) {
  size_t length = strlen(payload);
  if (length == 0 || length > FRAME_LIMIT) {
    return -1;
  }
  uint32_t header = htonl((uint32_t)length);
  if (write_all(EVENT_FD, &header, sizeof(header)) != 0 ||
      write_all(EVENT_FD, payload, length) != 0) {
    return -1;
  }
  return 0;
}

static int read_all_deadline(int fd, void *buffer, size_t length,
                             long long deadline_ms) {
  unsigned char *cursor = buffer;
  while (length > 0) {
    long long now = monotonic_ms();
    if (now < 0 || now >= deadline_ms) {
      errno = ETIMEDOUT;
      return -1;
    }
    int timeout = (int)(deadline_ms - now);
    struct pollfd item = {.fd = fd, .events = POLLIN | POLLHUP, .revents = 0};
    int selected = poll(&item, 1, timeout);
    if (selected <= 0) {
      if (selected < 0 && errno == EINTR) {
        continue;
      }
      errno = selected == 0 ? ETIMEDOUT : errno;
      return -1;
    }
    if ((item.revents & (POLLERR | POLLNVAL)) != 0) {
      errno = EPROTO;
      return -1;
    }
    ssize_t received = read(fd, cursor, length);
    if (received <= 0) {
      errno = received == 0 ? EPIPE : errno;
      return -1;
    }
    cursor += (size_t)received;
    length -= (size_t)received;
  }
  return 0;
}

static int read_frame(char *payload, size_t capacity, long long deadline_ms) {
  uint32_t header = 0;
  if (read_all_deadline(CONTROL_FD, &header, sizeof(header), deadline_ms) != 0) {
    return -1;
  }
  uint32_t length = ntohl(header);
  if (length == 0 || length >= capacity || length > FRAME_LIMIT) {
    errno = EMSGSIZE;
    return -1;
  }
  if (read_all_deadline(CONTROL_FD, payload, length, deadline_ms) != 0) {
    return -1;
  }
  payload[length] = '\0';
  return 0;
}

static int fill_random(unsigned char *buffer, size_t length) {
#if defined(__APPLE__)
  arc4random_buf(buffer, length);
  return 0;
#else
  size_t offset = 0;
  while (offset < length) {
    ssize_t result = getrandom(buffer + offset, length - offset, 0);
    if (result < 0) {
      if (errno == EINTR) {
        continue;
      }
      return -1;
    }
    offset += (size_t)result;
  }
  return 0;
#endif
}

static void hex_encode(const unsigned char *input, size_t length, char *output) {
  static const char alphabet[] = "0123456789abcdef";
  for (size_t index = 0; index < length; index += 1) {
    output[index * 2] = alphabet[input[index] >> 4];
    output[(index * 2) + 1] = alphabet[input[index] & 15U];
  }
  output[length * 2] = '\0';
}

static int hex_decode(const char *input, char *output, size_t capacity) {
  size_t length = strlen(input);
  if (length == 0 || (length % 2) != 0 || (length / 2) >= capacity) {
    return -1;
  }
  for (size_t index = 0; index < length; index += 2) {
    unsigned int byte = 0;
    if (sscanf(input + index, "%2x", &byte) != 1) {
      return -1;
    }
    output[index / 2] = (char)byte;
  }
  output[length / 2] = '\0';
  return 0;
}

typedef struct {
  uint32_t state[8];
  uint64_t bit_length;
  unsigned char block[64];
  size_t block_length;
} sha256_context;

static uint32_t rotate_right(uint32_t value, unsigned int count) {
  return (value >> count) | (value << (32U - count));
}

static void sha256_transform(sha256_context *context,
                             const unsigned char block[64]) {
  static const uint32_t constants[64] = {
      0x428a2f98U, 0x71374491U, 0xb5c0fbcfU, 0xe9b5dba5U,
      0x3956c25bU, 0x59f111f1U, 0x923f82a4U, 0xab1c5ed5U,
      0xd807aa98U, 0x12835b01U, 0x243185beU, 0x550c7dc3U,
      0x72be5d74U, 0x80deb1feU, 0x9bdc06a7U, 0xc19bf174U,
      0xe49b69c1U, 0xefbe4786U, 0x0fc19dc6U, 0x240ca1ccU,
      0x2de92c6fU, 0x4a7484aaU, 0x5cb0a9dcU, 0x76f988daU,
      0x983e5152U, 0xa831c66dU, 0xb00327c8U, 0xbf597fc7U,
      0xc6e00bf3U, 0xd5a79147U, 0x06ca6351U, 0x14292967U,
      0x27b70a85U, 0x2e1b2138U, 0x4d2c6dfcU, 0x53380d13U,
      0x650a7354U, 0x766a0abbU, 0x81c2c92eU, 0x92722c85U,
      0xa2bfe8a1U, 0xa81a664bU, 0xc24b8b70U, 0xc76c51a3U,
      0xd192e819U, 0xd6990624U, 0xf40e3585U, 0x106aa070U,
      0x19a4c116U, 0x1e376c08U, 0x2748774cU, 0x34b0bcb5U,
      0x391c0cb3U, 0x4ed8aa4aU, 0x5b9cca4fU, 0x682e6ff3U,
      0x748f82eeU, 0x78a5636fU, 0x84c87814U, 0x8cc70208U,
      0x90befffaU, 0xa4506cebU, 0xbef9a3f7U, 0xc67178f2U};
  uint32_t words[64];
  for (size_t index = 0; index < 16; index += 1) {
    size_t offset = index * 4;
    words[index] = ((uint32_t)block[offset] << 24) |
                   ((uint32_t)block[offset + 1] << 16) |
                   ((uint32_t)block[offset + 2] << 8) |
                   (uint32_t)block[offset + 3];
  }
  for (size_t index = 16; index < 64; index += 1) {
    uint32_t left = words[index - 15];
    uint32_t right = words[index - 2];
    uint32_t s0 = rotate_right(left, 7) ^ rotate_right(left, 18) ^ (left >> 3);
    uint32_t s1 = rotate_right(right, 17) ^ rotate_right(right, 19) ^
                  (right >> 10);
    words[index] = words[index - 16] + s0 + words[index - 7] + s1;
  }
  uint32_t a = context->state[0], b = context->state[1];
  uint32_t c = context->state[2], d = context->state[3];
  uint32_t e = context->state[4], f = context->state[5];
  uint32_t g = context->state[6], h = context->state[7];
  for (size_t index = 0; index < 64; index += 1) {
    uint32_t sum1 = rotate_right(e, 6) ^ rotate_right(e, 11) ^
                    rotate_right(e, 25);
    uint32_t choice = (e & f) ^ ((~e) & g);
    uint32_t temporary1 = h + sum1 + choice + constants[index] + words[index];
    uint32_t sum0 = rotate_right(a, 2) ^ rotate_right(a, 13) ^
                    rotate_right(a, 22);
    uint32_t majority = (a & b) ^ (a & c) ^ (b & c);
    uint32_t temporary2 = sum0 + majority;
    h = g;
    g = f;
    f = e;
    e = d + temporary1;
    d = c;
    c = b;
    b = a;
    a = temporary1 + temporary2;
  }
  context->state[0] += a;
  context->state[1] += b;
  context->state[2] += c;
  context->state[3] += d;
  context->state[4] += e;
  context->state[5] += f;
  context->state[6] += g;
  context->state[7] += h;
}

static void sha256_initialize(sha256_context *context) {
  memset(context, 0, sizeof(*context));
  context->state[0] = 0x6a09e667U;
  context->state[1] = 0xbb67ae85U;
  context->state[2] = 0x3c6ef372U;
  context->state[3] = 0xa54ff53aU;
  context->state[4] = 0x510e527fU;
  context->state[5] = 0x9b05688cU;
  context->state[6] = 0x1f83d9abU;
  context->state[7] = 0x5be0cd19U;
}

static void sha256_update(sha256_context *context,
                          const unsigned char *bytes, size_t length) {
  for (size_t index = 0; index < length; index += 1) {
    context->block[context->block_length++] = bytes[index];
    if (context->block_length == sizeof(context->block)) {
      sha256_transform(context, context->block);
      context->bit_length += 512U;
      context->block_length = 0;
    }
  }
}

static void sha256_finish(sha256_context *context, char output[65]) {
  size_t index = context->block_length;
  context->block[index++] = 0x80U;
  if (index > 56) {
    while (index < 64) {
      context->block[index++] = 0;
    }
    sha256_transform(context, context->block);
    index = 0;
  }
  while (index < 56) {
    context->block[index++] = 0;
  }
  context->bit_length += (uint64_t)context->block_length * 8U;
  for (size_t byte = 0; byte < 8; byte += 1) {
    context->block[63 - byte] =
        (unsigned char)(context->bit_length >> (byte * 8U));
  }
  sha256_transform(context, context->block);
  unsigned char digest[32];
  for (size_t word = 0; word < 8; word += 1) {
    digest[word * 4] = (unsigned char)(context->state[word] >> 24);
    digest[(word * 4) + 1] = (unsigned char)(context->state[word] >> 16);
    digest[(word * 4) + 2] = (unsigned char)(context->state[word] >> 8);
    digest[(word * 4) + 3] = (unsigned char)context->state[word];
  }
  hex_encode(digest, sizeof(digest), output);
}

static int is_lower_hex(const char *value, size_t length) {
  if (strlen(value) != length) {
    return 0;
  }
  for (size_t index = 0; index < length; index += 1) {
    if (!((value[index] >= '0' && value[index] <= '9') ||
          (value[index] >= 'a' && value[index] <= 'f'))) {
      return 0;
    }
  }
  return 1;
}

static void reset_child_signals(void) {
  sigset_t empty;
  (void)sigemptyset(&empty);
  (void)sigprocmask(SIG_SETMASK, &empty, NULL);
  for (int signal_number = 1; signal_number < NSIG; signal_number += 1) {
    if (signal_number == SIGKILL || signal_number == SIGSTOP) {
      continue;
    }
    (void)signal(signal_number, SIG_DFL);
  }
}

static void close_child_descriptors(int retained_fd, int retained_binary_fd) {
  long maximum = sysconf(_SC_OPEN_MAX);
  if (maximum < 64 || maximum > 65536) {
    maximum = 65536;
  }
  for (int fd = 3; fd < maximum; fd += 1) {
    if (fd != retained_fd && fd != retained_binary_fd) {
      (void)close(fd);
    }
  }
}

static int path_matches_binary_fd(const char *path, int descriptor) {
  struct stat path_state, descriptor_state;
  return fstatat(AT_FDCWD, path, &path_state, AT_SYMLINK_NOFOLLOW) == 0 &&
      fstat(descriptor, &descriptor_state) == 0 &&
      S_ISREG(path_state.st_mode) &&
      path_state.st_dev == descriptor_state.st_dev &&
      path_state.st_ino == descriptor_state.st_ino &&
      path_state.st_uid == descriptor_state.st_uid &&
      path_state.st_gid == descriptor_state.st_gid &&
      path_state.st_mode == descriptor_state.st_mode &&
      path_state.st_size == descriptor_state.st_size;
}

static int wait_nonreaping(pid_t child, siginfo_t *information) {
  memset(information, 0, sizeof(*information));
  return waitid(P_PID, (id_t)child, information, WEXITED | WNOHANG | WNOWAIT);
}

static int group_present(pid_t process_group) {
  if (kill(-process_group, 0) == 0) {
    return 1;
  }
  if (errno == ESRCH) {
    return 0;
  }
  return -1;
}

static int reap_exact_child(pid_t child, int *status) {
  for (;;) {
    pid_t result = waitpid(child, status, 0);
    if (result == child) {
      return 0;
    }
    if (result < 0 && errno == EINTR) {
      continue;
    }
    return -1;
  }
}

static int terminate_initdb_group(pid_t child, int timed_out,
                                  int *terminal_status) {
  siginfo_t information;
  if (wait_nonreaping(child, &information) != 0) {
    return 2;
  }
  int terminal = information.si_pid == child;
  int present = group_present(child);
  if (present < 0) {
    if (terminal) {
      if (reap_exact_child(child, terminal_status) != 0) {
        return 12;
      }
      return group_present(child) == 0 ? 0 : 13;
    }
    return 3;
  }
  if (timed_out || (terminal && present == 1)) {
    if (kill(-child, SIGTERM) != 0 && errno != ESRCH) {
      return 4;
    }
    long long grace = monotonic_ms() + 2000;
    while (monotonic_ms() < grace) {
      watchdog_touch();
      if (wait_nonreaping(child, &information) != 0) {
        return 5;
      }
      present = group_present(child);
      if (present == 0) {
        break;
      }
      if (present < 0) {
        return 6;
      }
      struct timespec pause = {.tv_sec = 0, .tv_nsec = 25000000L};
      (void)nanosleep(&pause, NULL);
    }
    if (present == 1) {
      if (wait_nonreaping(child, &information) != 0 ||
          information.si_pid != child) {
        return 7;
      }
      if (kill(-child, SIGKILL) != 0 && errno != ESRCH) {
        return 8;
      }
    }
  }
  if (reap_exact_child(child, terminal_status) != 0) {
    return 9;
  }
  for (int probe = 0; probe < 80; probe += 1) {
    present = group_present(child);
    if (present == 0) {
      return timed_out ? 1 : 0;
    }
    if (present < 0) {
      return 10;
    }
    struct timespec pause = {.tv_sec = 0, .tv_nsec = 25000000L};
    (void)nanosleep(&pause, NULL);
  }
  return 11;
}

static int spawn_initdb(const char *binary, const char *data_directory) {
  int gate[2];
  if (pipe(gate) != 0) {
    return -1;
  }
  pid_t child = fork();
  if (child < 0) {
    (void)close(gate[0]);
    (void)close(gate[1]);
    return -1;
  }
  if (child == 0) {
    (void)close(gate[1]);
    unsigned char release = 0;
    if (read(gate[0], &release, 1) != 1) {
      _exit(125);
    }
    (void)close(gate[0]);
    reset_child_signals();
    if (dup2(SECRET_FD, CHILD_PASSWORD_FD) != CHILD_PASSWORD_FD) {
      _exit(125);
    }
    if (fcntl(INITDB_FD, F_SETFD, 0) != 0) {
      _exit(125);
    }
    close_child_descriptors(CHILD_PASSWORD_FD, INITDB_FD);
    if (!path_matches_binary_fd(binary, INITDB_FD)) {
      _exit(125);
    }
    (void)umask(077);
    char *const arguments[] = {
        (char *)binary,
        (char *)"-D",
        (char *)data_directory,
        (char *)"--username=taptime_da5_v5_installer",
        (char *)"--auth-host=scram-sha-256",
        (char *)"--auth-local=reject",
        (char *)"--pwfile=/dev/fd/3",
        (char *)"--encoding=SQL_ASCII",
        (char *)"--no-locale",
        (char *)"--locale-provider=libc",
        (char *)"--no-sync",
        NULL};
    char *const environment[] = {
        (char *)"HOME=/var/empty",
        (char *)"PATH=/usr/bin:/bin",
        (char *)"TZ=UTC",
        NULL};
    execve(binary, arguments, environment);
    _exit(127);
  }
  (void)close(gate[0]);
  if (setpgid(child, child) != 0) {
    (void)close(gate[1]);
    (void)kill(child, SIGKILL);
    (void)waitpid(child, NULL, 0);
    return -1;
  }
  unsigned char release = 1;
  if (write_all(gate[1], &release, 1) != 0) {
    (void)close(gate[1]);
    (void)kill(-child, SIGKILL);
    (void)waitpid(child, NULL, 0);
    return -1;
  }
  (void)close(gate[1]);
  return (int)child;
}

static int supervise_initdb(pid_t child, int *terminal_status) {
  long long deadline = monotonic_ms() + INITDB_BUDGET_MS;
  for (;;) {
    watchdog_touch();
    siginfo_t information;
    if (wait_nonreaping(child, &information) != 0) {
      return 2;
    }
    if (information.si_pid == child) {
      int status = 0;
      int result = terminate_initdb_group(child, 0, &status);
      *terminal_status = status;
      if (result != 0) {
        return 30 + result;
      }
      if (!WIFEXITED(status)) {
        return 4;
      }
      return WEXITSTATUS(status) == 0 ? 0 : 5;
    }
    if (monotonic_ms() >= deadline) {
      int status = 0;
      int termination = terminate_initdb_group(child, 1, &status);
      *terminal_status = status;
      return termination == 0 ? 6 : 40 + termination;
    }
    struct timespec pause = {.tv_sec = 0, .tv_nsec = 25000000L};
    (void)nanosleep(&pause, NULL);
  }
}

typedef struct {
  int descriptors[3];
  struct stat identities[3];
  char digest[65];
} bound_configuration;

static int write_configuration_file(int data_fd, const char *name,
                                    const char *contents, int *descriptor,
                                    struct stat *identity) {
  struct stat generated;
  if (fstatat(data_fd, name, &generated, AT_SYMLINK_NOFOLLOW) != 0 ||
      !S_ISREG(generated.st_mode) || generated.st_nlink != 1 ||
      generated.st_uid != geteuid() ||
      unlinkat(data_fd, name, 0) != 0) {
    return -1;
  }
  int file = openat(data_fd, name,
                    O_CREAT | O_EXCL | O_RDWR | O_NOFOLLOW | O_CLOEXEC,
                    0600);
  if (file < 0 || write_all(file, contents, strlen(contents)) != 0 ||
      fsync(file) != 0 || fchmod(file, 0600) != 0 ||
      fstat(file, identity) != 0 || identity->st_nlink != 1 ||
      identity->st_uid != geteuid() ||
      (identity->st_mode & 0777) != 0600) {
    if (file >= 0) {
      (void)close(file);
    }
    return -1;
  }
  size_t length = strlen(contents);
  char *readback = malloc(length + 1);
  if (readback == NULL) {
    (void)close(file);
    return -1;
  }
  size_t position = 0;
  while (position < length) {
    ssize_t count = pread(file, readback + position, length - position,
                          (off_t)position);
    if (count <= 0) {
      free(readback);
      (void)close(file);
      return -1;
    }
    position += (size_t)count;
  }
  int valid = memcmp(readback, contents, length) == 0;
  free(readback);
  if (!valid) {
    (void)close(file);
    errno = ESTALE;
    return -1;
  }
  *descriptor = file;
  return 0;
}

static int bind_exact_configuration(const char *data_directory,
                                    const char *configuration,
                                    const char *hba,
                                    const char *expected_digest,
                                    bound_configuration *binding) {
  memset(binding, 0, sizeof(*binding));
  for (size_t index = 0; index < 3; index += 1) {
    binding->descriptors[index] = -1;
  }
  int data_fd = open(data_directory,
                     O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (data_fd < 0) {
    return -1;
  }
  const char *names[] = {
      "postgresql.conf", "pg_hba.conf", "postgresql.auto.conf"};
  const char *contents[] = {configuration, hba, ""};
  int result = 0;
  sha256_context digest;
  sha256_initialize(&digest);
  for (size_t index = 0; index < 3; index += 1) {
    if (write_configuration_file(
            data_fd, names[index], contents[index],
            &binding->descriptors[index], &binding->identities[index]) != 0) {
      result = -1;
      break;
    }
    sha256_update(&digest, (const unsigned char *)contents[index],
                  strlen(contents[index]));
    const unsigned char separator = 0;
    sha256_update(&digest, &separator, 1);
  }
  (void)close(data_fd);
  if (result == 0) {
    sha256_finish(&digest, binding->digest);
    if (strcmp(binding->digest, expected_digest) != 0) {
      result = -1;
      errno = ESTALE;
    }
  }
  if (result != 0) {
    for (size_t index = 0; index < 3; index += 1) {
      if (binding->descriptors[index] >= 0) {
        (void)close(binding->descriptors[index]);
        binding->descriptors[index] = -1;
      }
    }
  }
  return result;
}

static int revalidate_configuration(const bound_configuration *binding) {
  sha256_context digest;
  sha256_initialize(&digest);
  for (size_t index = 0; index < 3; index += 1) {
    struct stat current;
    if (binding->descriptors[index] < 0 ||
        fstat(binding->descriptors[index], &current) != 0 ||
        current.st_dev != binding->identities[index].st_dev ||
        current.st_ino != binding->identities[index].st_ino ||
        current.st_uid != binding->identities[index].st_uid ||
        current.st_gid != binding->identities[index].st_gid ||
        current.st_mode != binding->identities[index].st_mode ||
        current.st_size != binding->identities[index].st_size ||
        current.st_nlink != 1) {
      return -1;
    }
    if (current.st_size < 0 || current.st_size > 4096) {
      return -1;
    }
    size_t length = (size_t)current.st_size;
    unsigned char buffer[4096];
    size_t position = 0;
    while (position < length) {
      ssize_t count = pread(
          binding->descriptors[index], buffer + position, length - position,
          (off_t)position);
      if (count <= 0) {
        return -1;
      }
      position += (size_t)count;
    }
    sha256_update(&digest, buffer, length);
    const unsigned char separator = 0;
    sha256_update(&digest, &separator, 1);
  }
  char actual_digest[65];
  sha256_finish(&digest, actual_digest);
  return strcmp(actual_digest, binding->digest) == 0 ? 0 : -1;
}

static void close_configuration(bound_configuration *binding) {
  for (size_t index = 0; index < 3; index += 1) {
    if (binding->descriptors[index] >= 0) {
      (void)close(binding->descriptors[index]);
      binding->descriptors[index] = -1;
    }
  }
}

static pid_t spawn_postgres(const char *binary, const char *data_directory,
                            const char *socket_directory, const char *log_path) {
  if (!path_matches_binary_fd(binary, POSTGRES_FD)) {
    return -1;
  }
  int log_fd = open(log_path, O_CREAT | O_EXCL | O_WRONLY | O_NOFOLLOW | O_CLOEXEC,
                    0600);
  if (log_fd < 0) {
    return -1;
  }
  char socket_option[2048];
  (void)snprintf(socket_option, sizeof(socket_option),
                 "unix_socket_directories=%s", socket_directory);
  char *const arguments[] = {
      (char *)binary,
      (char *)"-D",
      (char *)data_directory,
      (char *)"-c",
      (char *)"listen_addresses=127.0.0.1",
      (char *)"-c",
      (char *)"port=55435",
      (char *)"-c",
      socket_option,
      NULL};
  char *const environment[] = {
      (char *)"HOME=/var/empty",
      (char *)"LC_ALL=C",
      (char *)"PATH=/usr/bin:/bin",
      (char *)"TZ=UTC",
      NULL};
  posix_spawn_file_actions_t actions;
  posix_spawnattr_t attributes;
  int actions_initialized = 0;
  int attributes_initialized = 0;
  int result = posix_spawn_file_actions_init(&actions);
  if (result == 0) {
    actions_initialized = 1;
    result = posix_spawn_file_actions_adddup2(&actions, log_fd, STDOUT_FILENO);
  }
  if (result == 0) {
    result = posix_spawn_file_actions_adddup2(&actions, log_fd, STDERR_FILENO);
  }
  const int inherited[] = {
      CONTROL_FD, EVENT_FD, ROOT_FD, STAGING_FD, BASE_FD, PG_CONFIG_FD,
      INITDB_FD};
  for (size_t index = 0;
       result == 0 && index < sizeof(inherited) / sizeof(inherited[0]);
       index += 1) {
    if (inherited[index] != log_fd) {
      result = posix_spawn_file_actions_addclose(&actions, inherited[index]);
    }
  }
  if (result == 0 && log_fd > STDERR_FILENO) {
    result = posix_spawn_file_actions_addclose(&actions, log_fd);
  }
  if (result == 0) {
    result = posix_spawnattr_init(&attributes);
    attributes_initialized = result == 0;
  }
  sigset_t empty_mask;
  sigset_t default_signals;
  (void)sigemptyset(&empty_mask);
  (void)sigemptyset(&default_signals);
  for (int signal_number = 1; signal_number < NSIG; signal_number += 1) {
    if (signal_number != SIGKILL && signal_number != SIGSTOP) {
      (void)sigaddset(&default_signals, signal_number);
    }
  }
  if (result == 0) {
    result = posix_spawnattr_setsigmask(&attributes, &empty_mask);
  }
  if (result == 0) {
    result = posix_spawnattr_setsigdefault(&attributes, &default_signals);
  }
  if (result == 0) {
    result = posix_spawnattr_setflags(
        &attributes,
        (short)(POSIX_SPAWN_SETSIGMASK | POSIX_SPAWN_SETSIGDEF));
  }
  pid_t child = -1;
  if (result == 0) {
    result = posix_spawn(&child, binary, &actions, &attributes,
                         arguments, environment);
  }
  if (attributes_initialized) {
    (void)posix_spawnattr_destroy(&attributes);
  }
  if (actions_initialized) {
    (void)posix_spawn_file_actions_destroy(&actions);
  }
  (void)close(log_fd);
  return result == 0 ? child : -1;
}

static int wait_postgres_stop(pid_t child) {
  long long deadline = monotonic_ms() + POSTGRES_STOP_BUDGET_MS;
  for (;;) {
    watchdog_touch();
    siginfo_t information;
    if (wait_nonreaping(child, &information) != 0) {
      return -1;
    }
    if (information.si_pid == child) {
      return reap_exact_child(child, &(int){0});
    }
    if (monotonic_ms() >= deadline) {
      return 1;
    }
    struct timespec pause = {.tv_sec = 0, .tv_nsec = 25000000L};
    (void)nanosleep(&pause, NULL);
  }
}

static int rename_exclusive(int parent_fd, const char *source,
                            const char *destination) {
#if defined(__APPLE__)
  return renameatx_np(parent_fd, source, parent_fd, destination, RENAME_EXCL);
#elif defined(__linux__)
  return (int)syscall(SYS_renameat2, parent_fd, source, parent_fd, destination,
                      RENAME_NOREPLACE);
#else
  (void)parent_fd;
  (void)source;
  (void)destination;
  errno = ENOTSUP;
  return -1;
#endif
}

enum {
  CLEANUP_ENTRY_LIMIT = 100000,
  CLEANUP_FD_LIMIT = 2048,
  CLEANUP_DEPTH_LIMIT = 128,
  CLEANUP_NAME_LIMIT = 1024
};

typedef struct cleanup_mount_identity {
  struct statfs state;
#if defined(__linux__)
  uint64_t mount_id;
  int mount_id_kind;
#endif
} cleanup_mount_identity;

typedef struct cleanup_plan_entry {
  int descriptor;
  size_t parent;
  unsigned int depth;
  int removed;
  char name[CLEANUP_NAME_LIMIT];
  struct stat identity;
  cleanup_mount_identity mount;
  char acl_digest[65];
} cleanup_plan_entry;

typedef struct cleanup_plan {
  cleanup_plan_entry *entries;
  size_t count;
  size_t capacity;
} cleanup_plan;

static int same_mount_state(const struct statfs *left,
                            const struct statfs *right);

static int compare_cleanup_names(const void *left, const void *right) {
  const char *const *left_name = left;
  const char *const *right_name = right;
  return strcmp(*left_name, *right_name);
}

static void free_cleanup_names(char **names, size_t count) {
  if (names == NULL) {
    return;
  }
  for (size_t index = 0; index < count; index += 1) {
    free(names[index]);
  }
  free(names);
}

static int read_sorted_cleanup_names(int directory_fd, char ***names_out,
                                     size_t *count_out) {
  int scan_fd = openat(
      directory_fd, ".", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (scan_fd < 0) {
    return -1;
  }
  DIR *directory = fdopendir(scan_fd);
  if (directory == NULL) {
    (void)close(scan_fd);
    return -1;
  }
  char **names = NULL;
  size_t count = 0;
  struct dirent *entry;
  while ((entry = readdir(directory)) != NULL) {
    if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
      continue;
    }
    size_t length = strlen(entry->d_name);
    if (length == 0 || length >= CLEANUP_NAME_LIMIT ||
        count >= CLEANUP_ENTRY_LIMIT) {
      free_cleanup_names(names, count);
      (void)closedir(directory);
      errno = length >= CLEANUP_NAME_LIMIT ? ENAMETOOLONG : E2BIG;
      return -1;
    }
    char **expanded = realloc(names, (count + 1) * sizeof(*expanded));
    if (expanded == NULL) {
      free_cleanup_names(names, count);
      (void)closedir(directory);
      return -1;
    }
    names = expanded;
    names[count] = strdup(entry->d_name);
    if (names[count] == NULL) {
      free_cleanup_names(names, count);
      (void)closedir(directory);
      return -1;
    }
    count += 1;
  }
  if (closedir(directory) != 0) {
    free_cleanup_names(names, count);
    return -1;
  }
  qsort(names, count, sizeof(*names), compare_cleanup_names);
  *names_out = names;
  *count_out = count;
  return 0;
}

static int cleanup_acl_identity(int descriptor, char digest[65]) {
  sha256_context identity;
  sha256_initialize(&identity);
#if defined(__APPLE__)
  acl_t acl = acl_get_fd_np(descriptor, ACL_TYPE_EXTENDED);
  if (acl == NULL) {
    if (errno != ENOENT) {
      return -1;
    }
    errno = 0;
  } else {
    (void)acl_free(acl);
    errno = EACCES;
    return -1;
  }
#else
  unsigned char value[4096];
  ssize_t access_length =
      fgetxattr(descriptor, "system.posix_acl_access", value, sizeof(value));
  if (access_length >= 0 ||
      (errno != ENODATA && errno != ENOTSUP && errno != EOPNOTSUPP)) {
    errno = EACCES;
    return -1;
  }
  ssize_t default_length =
      fgetxattr(descriptor, "system.posix_acl_default", value, sizeof(value));
  if (default_length >= 0 ||
      (errno != ENODATA && errno != ENOTSUP && errno != EOPNOTSUPP)) {
    errno = EACCES;
    return -1;
  }
#endif
  static const unsigned char empty_acl[] = "DA5-V5-EMPTY-ACL-V1";
  sha256_update(&identity, empty_acl, sizeof(empty_acl) - 1);
  sha256_finish(&identity, digest);
  return 0;
}

static int validate_cleanup_descriptor(
    int descriptor, dev_t expected_device,
    const struct statfs *expected_mount, const struct stat *expected,
    struct stat *actual, char acl_digest[65]) {
  struct statfs mount;
  if (fstat(descriptor, actual) != 0 ||
      fstatfs(descriptor, &mount) != 0 ||
      actual->st_dev != expected_device ||
      actual->st_uid != geteuid() ||
      (actual->st_mode & 0077) != 0 ||
      !same_mount_state(expected_mount, &mount) ||
      cleanup_acl_identity(descriptor, acl_digest) != 0) {
    return -1;
  }
  if (expected != NULL &&
      (actual->st_dev != expected->st_dev ||
       actual->st_ino != expected->st_ino ||
       actual->st_uid != expected->st_uid ||
       actual->st_gid != expected->st_gid ||
       actual->st_mode != expected->st_mode ||
       (S_ISREG(expected->st_mode) &&
        actual->st_nlink != expected->st_nlink))) {
    errno = ESTALE;
    return -1;
  }
  return 0;
}

static int capture_cleanup_mount_identity(
    int descriptor, cleanup_mount_identity *identity) {
  (void)memset(identity, 0, sizeof(*identity));
  if (fstatfs(descriptor, &identity->state) != 0) {
    return -1;
  }
#if defined(__linux__) && defined(SYS_statx)
  struct statx state;
  (void)memset(&state, 0, sizeof(state));
#if defined(STATX_MNT_ID_UNIQUE)
  int unique_result = (int)syscall(
      SYS_statx, descriptor, "", AT_EMPTY_PATH | AT_NO_AUTOMOUNT,
      STATX_BASIC_STATS | STATX_MNT_ID_UNIQUE, &state);
  if (unique_result == 0) {
    if ((state.stx_mask & STATX_MNT_ID_UNIQUE) != 0) {
      identity->mount_id = state.stx_mnt_id;
      identity->mount_id_kind = 2;
      return 0;
    }
  } else if (errno != EINVAL && errno != ENOSYS &&
             errno != EOPNOTSUPP && errno != EPERM) {
    return -1;
  }
#endif
#if defined(STATX_MNT_ID)
  (void)memset(&state, 0, sizeof(state));
  int mount_result = (int)syscall(
      SYS_statx, descriptor, "", AT_EMPTY_PATH | AT_NO_AUTOMOUNT,
      STATX_BASIC_STATS | STATX_MNT_ID, &state);
  if (mount_result == 0) {
    if ((state.stx_mask & STATX_MNT_ID) != 0) {
      identity->mount_id = state.stx_mnt_id;
      identity->mount_id_kind = 1;
      return 0;
    }
  } else if (errno != EINVAL && errno != ENOSYS &&
             errno != EOPNOTSUPP && errno != EPERM) {
    return -1;
  }
#endif
#endif
#if defined(__linux__)
  errno = ENOTSUP;
  return -1;
#else
  return 0;
#endif
}

static int same_cleanup_mount_identity(
    const cleanup_mount_identity *left,
    const cleanup_mount_identity *right) {
  if (!same_mount_state(&left->state, &right->state)) {
    return 0;
  }
#if defined(__linux__)
  if (left->mount_id_kind != right->mount_id_kind) {
    return 0;
  }
  if (left->mount_id_kind != 0 && left->mount_id != right->mount_id) {
    return 0;
  }
#endif
  return 1;
}

static int same_cleanup_named_identity(
    const struct stat *left, const struct stat *right) {
  return left->st_dev == right->st_dev &&
      left->st_ino == right->st_ino &&
      left->st_uid == right->st_uid &&
      left->st_gid == right->st_gid &&
      left->st_mode == right->st_mode &&
      left->st_size == right->st_size &&
      left->st_nlink == right->st_nlink;
}

static int same_cleanup_retained_identity(
    const struct stat *expected, const struct stat *actual) {
  return expected->st_dev == actual->st_dev &&
      expected->st_ino == actual->st_ino &&
      expected->st_uid == actual->st_uid &&
      expected->st_gid == actual->st_gid &&
      expected->st_mode == actual->st_mode &&
      (!S_ISREG(expected->st_mode) ||
       (expected->st_size == actual->st_size &&
        expected->st_nlink == actual->st_nlink));
}

static void close_cleanup_plan(cleanup_plan *plan) {
  if (plan == NULL) {
    return;
  }
  for (size_t index = 0; index < plan->count; index += 1) {
    if (plan->entries[index].descriptor >= 0) {
      (void)close(plan->entries[index].descriptor);
      plan->entries[index].descriptor = -1;
    }
  }
  free(plan->entries);
  plan->entries = NULL;
  plan->count = 0;
  plan->capacity = 0;
}

static int append_cleanup_plan_entry(
    cleanup_plan *plan, const cleanup_plan_entry *entry,
    size_t *index_out) {
  if (plan->count >= CLEANUP_FD_LIMIT) {
    errno = E2BIG;
    return -1;
  }
  if (plan->count == plan->capacity) {
    size_t next_capacity = plan->capacity == 0 ? 32 : plan->capacity * 2;
    if (next_capacity > CLEANUP_FD_LIMIT) {
      next_capacity = CLEANUP_FD_LIMIT;
    }
    cleanup_plan_entry *expanded = realloc(
        plan->entries, next_capacity * sizeof(*expanded));
    if (expanded == NULL) {
      return -1;
    }
    plan->entries = expanded;
    plan->capacity = next_capacity;
  }
  plan->entries[plan->count] = *entry;
  *index_out = plan->count;
  plan->count += 1;
  return 0;
}

static int update_cleanup_inventory(
    sha256_context *inventory, const cleanup_plan_entry *entry,
    const struct stat *state, const char acl_digest[65]) {
  char record[2048];
  int record_length = snprintf(
      record, sizeof(record),
      "%u|%zu|%s|%llu|%llu|%u|%u|%u|%llu|%llu|%s\n",
      entry->depth, strlen(entry->name), entry->name,
      (unsigned long long)state->st_dev,
      (unsigned long long)state->st_ino,
      (unsigned int)state->st_mode,
      (unsigned int)state->st_uid,
      (unsigned int)state->st_gid,
      (unsigned long long)state->st_size,
      (unsigned long long)state->st_nlink,
      acl_digest);
  if (record_length <= 0 || (size_t)record_length >= sizeof(record)) {
    errno = EOVERFLOW;
    return -1;
  }
  sha256_update(inventory, (const unsigned char *)record,
                (size_t)record_length);
  return 0;
}

static int bind_cleanup_plan_bounded(
    cleanup_plan *plan, int directory_fd, size_t parent,
    dev_t expected_device, const cleanup_mount_identity *root_mount,
    unsigned int depth, size_t *remaining, sha256_context *inventory) {
  if (depth > CLEANUP_DEPTH_LIMIT || remaining == NULL) {
    errno = EOVERFLOW;
    return -1;
  }
  char **names = NULL;
  size_t name_count = 0;
  if (read_sorted_cleanup_names(directory_fd, &names, &name_count) != 0) {
    return -1;
  }
  for (size_t name_index = 0; name_index < name_count; name_index += 1) {
    const char *entry_name = names[name_index];
    if (*remaining == 0) {
      free_cleanup_names(names, name_count);
      errno = E2BIG;
      return -1;
    }
    *remaining -= 1;
    struct stat named_state;
    if (fstatat(directory_fd, entry_name, &named_state,
                AT_SYMLINK_NOFOLLOW) != 0) {
      free_cleanup_names(names, name_count);
      return -1;
    }
    if (!S_ISREG(named_state.st_mode) && !S_ISDIR(named_state.st_mode)) {
      free_cleanup_names(names, name_count);
#if defined(__APPLE__)
      errno = EFTYPE;
#elif defined(__linux__)
      errno = EINVAL;
#else
#error "Unsupported DA5 V5 Runtime Guard platform"
#endif
      return -1;
    }
    if (S_ISREG(named_state.st_mode) && named_state.st_nlink != 1) {
      free_cleanup_names(names, name_count);
      errno = EMLINK;
      return -1;
    }
    int child = openat(
        directory_fd, entry_name,
        S_ISDIR(named_state.st_mode)
            ? O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC
            : O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
    cleanup_plan_entry entry;
    (void)memset(&entry, 0, sizeof(entry));
    entry.descriptor = child;
    entry.parent = parent;
    entry.depth = depth;
    if (child < 0 ||
        strlen(entry_name) >= sizeof(entry.name) ||
        validate_cleanup_descriptor(
            child, expected_device, &root_mount->state, &named_state,
            &entry.identity, entry.acl_digest) != 0 ||
        capture_cleanup_mount_identity(child, &entry.mount) != 0 ||
        !same_cleanup_mount_identity(root_mount, &entry.mount)) {
      if (child >= 0) {
        (void)close(child);
      }
      free_cleanup_names(names, name_count);
      return -1;
    }
    (void)memcpy(entry.name, entry_name, strlen(entry_name) + 1);
    size_t entry_index;
    if (append_cleanup_plan_entry(plan, &entry, &entry_index) != 0) {
      (void)close(child);
      free_cleanup_names(names, name_count);
      return -1;
    }
    if (update_cleanup_inventory(
            inventory, &plan->entries[entry_index],
            &plan->entries[entry_index].identity,
            plan->entries[entry_index].acl_digest) != 0) {
      free_cleanup_names(names, name_count);
      return -1;
    }
    if (S_ISDIR(named_state.st_mode) &&
        bind_cleanup_plan_bounded(
            plan, child, entry_index, expected_device, root_mount,
            depth + 1, remaining, inventory) != 0) {
      free_cleanup_names(names, name_count);
      return -1;
    }
  }
  free_cleanup_names(names, name_count);
  return 0;
}

static int bind_cleanup_plan(
    cleanup_plan *plan, int directory_fd, dev_t expected_device,
    cleanup_mount_identity *root_mount, char digest[65]) {
  size_t remaining = CLEANUP_ENTRY_LIMIT;
  sha256_context inventory;
  sha256_initialize(&inventory);
  if (capture_cleanup_mount_identity(directory_fd, root_mount) != 0 ||
      bind_cleanup_plan_bounded(
          plan, directory_fd, SIZE_MAX, expected_device, root_mount, 0,
          &remaining, &inventory) != 0) {
    return -1;
  }
  sha256_finish(&inventory, digest);
  return 0;
}

static int validate_cleanup_directory_names(
    const cleanup_plan *plan, int directory_fd, size_t parent) {
  char **names = NULL;
  size_t name_count = 0;
  if (read_sorted_cleanup_names(directory_fd, &names, &name_count) != 0) {
    return -1;
  }
  size_t expected_count = 0;
  for (size_t index = 0; index < plan->count; index += 1) {
    if (plan->entries[index].parent == parent) {
      if (expected_count >= name_count ||
          strcmp(names[expected_count], plan->entries[index].name) != 0) {
        free_cleanup_names(names, name_count);
        errno = ESTALE;
        return -1;
      }
      expected_count += 1;
    }
  }
  free_cleanup_names(names, name_count);
  if (expected_count != name_count) {
    errno = ESTALE;
    return -1;
  }
  return 0;
}

static int validate_cleanup_directory_after_removal(
    const cleanup_plan *plan, int directory_fd, size_t parent,
    size_t removed_index) {
  char **names = NULL;
  size_t name_count = 0;
  if (read_sorted_cleanup_names(directory_fd, &names, &name_count) != 0) {
    return -1;
  }
  size_t expected_count = 0;
  for (size_t index = 0; index < plan->count; index += 1) {
    const cleanup_plan_entry *entry = &plan->entries[index];
    if (entry->parent == parent && entry->removed == 0 &&
        index != removed_index) {
      if (expected_count >= name_count ||
          strcmp(names[expected_count], entry->name) != 0) {
        free_cleanup_names(names, name_count);
        errno = ESTALE;
        return -1;
      }
      expected_count += 1;
    }
  }
  free_cleanup_names(names, name_count);
  if (expected_count != name_count) {
    errno = ESTALE;
    return -1;
  }
  return 0;
}

static int revalidate_cleanup_plan(
    const cleanup_plan *plan, int root_fd, dev_t expected_device,
    const cleanup_mount_identity *root_mount, char digest[65]) {
  cleanup_mount_identity current_root_mount;
  if (capture_cleanup_mount_identity(root_fd, &current_root_mount) != 0 ||
      !same_cleanup_mount_identity(root_mount, &current_root_mount) ||
      validate_cleanup_directory_names(plan, root_fd, SIZE_MAX) != 0) {
    return -1;
  }
  for (size_t index = 0; index < plan->count; index += 1) {
    const cleanup_plan_entry *entry = &plan->entries[index];
    int parent_fd = entry->parent == SIZE_MAX
        ? root_fd : plan->entries[entry->parent].descriptor;
    struct stat named_now;
    struct stat retained_now;
    char acl_digest[65];
    cleanup_mount_identity mount_now;
    if (fstatat(parent_fd, entry->name, &named_now,
                AT_SYMLINK_NOFOLLOW) != 0 ||
        !same_cleanup_named_identity(&entry->identity, &named_now) ||
        validate_cleanup_descriptor(
            entry->descriptor, expected_device, &root_mount->state,
            &entry->identity, &retained_now, acl_digest) != 0 ||
        !same_cleanup_named_identity(&entry->identity, &retained_now) ||
        strcmp(entry->acl_digest, acl_digest) != 0 ||
        capture_cleanup_mount_identity(entry->descriptor, &mount_now) != 0 ||
        !same_cleanup_mount_identity(root_mount, &mount_now) ||
        !same_cleanup_mount_identity(&entry->mount, &mount_now) ||
        (S_ISDIR(entry->identity.st_mode) &&
         validate_cleanup_directory_names(
             plan, entry->descriptor, index) != 0)) {
      return -1;
    }
  }
  sha256_context inventory;
  sha256_initialize(&inventory);
  for (size_t index = 0; index < plan->count; index += 1) {
    const cleanup_plan_entry *entry = &plan->entries[index];
    struct stat current;
    if (fstat(entry->descriptor, &current) != 0 ||
        update_cleanup_inventory(
            &inventory, entry, &current, entry->acl_digest) != 0) {
      return -1;
    }
  }
  sha256_finish(&inventory, digest);
  return 0;
}

static int removed_directory_nlink_matches(const struct stat *before,
                                           const struct stat *after) {
#if defined(__APPLE__)
  return after->st_nlink == before->st_nlink;
#else
  (void)before;
  return after->st_nlink == 0;
#endif
}

static int exact_command(const char *frame, const char *name,
                         const char *capability);

static int remove_cleanup_plan(
    cleanup_plan *plan, int root_fd, dev_t expected_device,
    const cleanup_mount_identity *root_mount, int test_cleanup_mode,
    const char *lifecycle_capability) {
#if !defined(DA5_V5_TEST_BUILD)
  (void)test_cleanup_mode;
  (void)lifecycle_capability;
#else
  int pause_consumed = 0;
  size_t removed_count = 0;
#endif
  for (size_t reverse = plan->count; reverse > 0; reverse -= 1) {
    size_t index = reverse - 1;
    cleanup_plan_entry *entry = &plan->entries[index];
    int parent_fd = entry->parent == SIZE_MAX
        ? root_fd : plan->entries[entry->parent].descriptor;
    struct stat retained_now;
    struct stat named_now;
    char acl_digest[65];
    cleanup_mount_identity mount_now;
    if (validate_cleanup_descriptor(
            entry->descriptor, expected_device, &root_mount->state,
            &entry->identity, &retained_now, acl_digest) != 0 ||
        !same_cleanup_retained_identity(&entry->identity, &retained_now) ||
        strcmp(entry->acl_digest, acl_digest) != 0 ||
        capture_cleanup_mount_identity(entry->descriptor, &mount_now) != 0 ||
        !same_cleanup_mount_identity(root_mount, &mount_now) ||
        !same_cleanup_mount_identity(&entry->mount, &mount_now) ||
        fstatat(parent_fd, entry->name, &named_now,
                AT_SYMLINK_NOFOLLOW) != 0 ||
        !same_cleanup_named_identity(&retained_now, &named_now)) {
      return -1;
    }
    if (S_ISDIR(entry->identity.st_mode)) {
      char **names = NULL;
      size_t name_count = 0;
      if (read_sorted_cleanup_names(
              entry->descriptor, &names, &name_count) != 0) {
        return -1;
      }
      free_cleanup_names(names, name_count);
      if (name_count != 0) {
        errno = ENOTEMPTY;
        return -1;
      }
    }
#if defined(DA5_V5_TEST_BUILD)
    if (test_cleanup_mode == 6) {
      (void)emit_frame("TEST_FORCED_EXIT|5");
      _exit(95);
    }
    if (test_cleanup_mode == 1 && !pause_consumed) {
      char continue_frame[FRAME_LIMIT + 1];
      pause_consumed = 1;
      if (emit_frame("TEST_CLEANUP_PAUSED") != 0 ||
          read_frame(
              continue_frame, sizeof(continue_frame),
              monotonic_ms() + 5000) != 0 ||
          !exact_command(
              continue_frame, "TEST_CONTINUE_CLEANUP",
              lifecycle_capability)) {
        errno = EPERM;
        return -1;
      }
    }
#endif
    if (unlinkat(
            parent_fd, entry->name,
            S_ISDIR(entry->identity.st_mode) ? AT_REMOVEDIR : 0) != 0) {
      return -1;
    }
    struct stat removed;
    struct stat absent;
    errno = 0;
    int valid = fstat(entry->descriptor, &removed) == 0 &&
        removed.st_ino == entry->identity.st_ino &&
        removed.st_dev == entry->identity.st_dev &&
        (S_ISREG(entry->identity.st_mode)
            ? removed.st_nlink == 0
            : removed_directory_nlink_matches(&retained_now, &removed)) &&
        fstatat(parent_fd, entry->name, &absent,
                AT_SYMLINK_NOFOLLOW) != 0 && errno == ENOENT &&
        validate_cleanup_directory_after_removal(
            plan, parent_fd, entry->parent, index) == 0;
    if (!valid) {
      errno = ESTALE;
      return -1;
    }
    entry->removed = 1;
#if defined(DA5_V5_TEST_BUILD)
    removed_count += 1;
    if (test_cleanup_mode == 7 && removed_count == 1) {
      (void)emit_frame("TEST_FORCED_EXIT|6");
      _exit(96);
    }
#endif
  }
  return 0;
}

static int revalidate_binary_descriptors(
    const bound_binary_descriptors *binding);
static int revalidate_mount_descriptors(
    const bound_mount_descriptors *binding);

#if defined(DA5_V5_TEST_BUILD)
static int cleanup_stage = 0;
#endif

static int cleanup_root(
    const char *root_name, const char *tombstone_name,
    const bound_mount_descriptors *mount_binding,
    const bound_binary_descriptors *binary_binding,
    int test_cleanup_mode, const char *lifecycle_capability) {
#if !defined(DA5_V5_TEST_BUILD)
  (void)test_cleanup_mode;
  (void)lifecycle_capability;
#endif
#if defined(DA5_V5_TEST_BUILD)
  cleanup_stage = 1;
#endif
  struct stat root_before, staging_before;
  struct stat root_validated, staging_validated;
  char root_acl_digest[65], staging_acl_digest[65];
  if (revalidate_mount_descriptors(mount_binding) != 0 ||
      revalidate_binary_descriptors(binary_binding) != 0 ||
      fstat(ROOT_FD, &root_before) != 0 ||
      fstat(STAGING_FD, &staging_before) != 0 ||
      validate_cleanup_descriptor(
          ROOT_FD, root_before.st_dev, &mount_binding->root, &root_before,
          &root_validated, root_acl_digest) != 0 ||
      validate_cleanup_descriptor(
          STAGING_FD, root_before.st_dev, &mount_binding->staging,
          &staging_before, &staging_validated, staging_acl_digest) != 0 ||
      root_before.st_dev != staging_before.st_dev ||
      fstatat(STAGING_FD, root_name, &(struct stat){0}, AT_SYMLINK_NOFOLLOW) != 0) {
    return -1;
  }
  struct stat named_before;
#if defined(DA5_V5_TEST_BUILD)
  cleanup_stage = 2;
#endif
  if (fstatat(STAGING_FD, root_name, &named_before, AT_SYMLINK_NOFOLLOW) != 0 ||
      named_before.st_ino != root_before.st_ino ||
      named_before.st_dev != root_before.st_dev ||
      !S_ISDIR(named_before.st_mode)) {
    errno = ESTALE;
    return -1;
  }
#if defined(DA5_V5_TEST_BUILD)
  cleanup_stage = 3;
  if (test_cleanup_mode == 3) {
    (void)emit_frame("TEST_FORCED_EXIT|2");
    _exit(92);
  }
#endif
  if (rename_exclusive(STAGING_FD, root_name, tombstone_name) != 0) {
    return -1;
  }
#if defined(DA5_V5_TEST_BUILD)
  if (test_cleanup_mode == 4) {
    (void)emit_frame("TEST_FORCED_EXIT|3");
    _exit(93);
  }
#endif
  struct stat original;
  if (fstatat(STAGING_FD, root_name, &original, AT_SYMLINK_NOFOLLOW) == 0 ||
      errno != ENOENT) {
    errno = ESTALE;
    return -1;
  }
  int tombstone = openat(STAGING_FD, tombstone_name,
                         O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  struct stat tombstone_state;
  if (tombstone < 0 || fstat(tombstone, &tombstone_state) != 0 ||
      tombstone_state.st_ino != root_before.st_ino ||
      tombstone_state.st_dev != root_before.st_dev) {
    if (tombstone >= 0) {
      (void)close(tombstone);
    }
    errno = ESTALE;
    return -1;
  }
  char first_inventory[65], second_inventory[65];
  cleanup_mount_identity cleanup_mount;
  cleanup_plan plan = {0};
#if defined(DA5_V5_TEST_BUILD)
  cleanup_stage = 4;
#endif
  if (bind_cleanup_plan(
          &plan, tombstone, root_before.st_dev, &cleanup_mount,
          first_inventory) != 0) {
    close_cleanup_plan(&plan);
    (void)close(tombstone);
    return -1;
  }
#if defined(DA5_V5_TEST_BUILD)
  if (test_cleanup_mode == 2) {
    if (plan.count == 0) {
      close_cleanup_plan(&plan);
      (void)close(tombstone);
      errno = ESTALE;
      return -1;
    }
#if defined(__APPLE__)
    plan.entries[0].mount.state.f_fsid.val[0] ^= 1;
#else
    if (plan.entries[0].mount.mount_id_kind != 0) {
      plan.entries[0].mount.mount_id ^= 1;
    } else {
      plan.entries[0].mount.state.f_type ^= 1;
    }
#endif
  }
#endif
  if (revalidate_cleanup_plan(
          &plan, tombstone, root_before.st_dev, &cleanup_mount,
          second_inventory) != 0) {
    close_cleanup_plan(&plan);
    (void)close(tombstone);
    return -1;
  }
  if (strcmp(first_inventory, second_inventory) != 0) {
    close_cleanup_plan(&plan);
    (void)close(tombstone);
    errno = ESTALE;
    return -1;
  }
#if defined(DA5_V5_TEST_BUILD)
  if (test_cleanup_mode == 5) {
    (void)emit_frame("TEST_FORCED_EXIT|4");
    _exit(94);
  }
#endif
#if defined(DA5_V5_TEST_BUILD)
  cleanup_stage = 5;
#endif
  if (revalidate_mount_descriptors(mount_binding) != 0 ||
      revalidate_binary_descriptors(binary_binding) != 0 ||
      remove_cleanup_plan(
          &plan, tombstone, root_before.st_dev, &cleanup_mount,
          test_cleanup_mode, lifecycle_capability) != 0) {
    close_cleanup_plan(&plan);
    (void)close(tombstone);
    return -1;
  }
  close_cleanup_plan(&plan);
  struct stat root_empty;
#if defined(DA5_V5_TEST_BUILD)
  cleanup_stage = 6;
#endif
  if (fstat(tombstone, &root_empty) != 0 ||
      root_empty.st_ino != root_before.st_ino ||
      root_empty.st_dev != root_before.st_dev) {
    (void)close(tombstone);
    errno = ESTALE;
    return -1;
  }
  struct stat root_last;
  char root_last_acl[65];
#if defined(DA5_V5_TEST_BUILD)
  cleanup_stage = 7;
#endif
  if (validate_cleanup_descriptor(
          tombstone, root_before.st_dev, &mount_binding->root, &root_empty,
          &root_last, root_last_acl) != 0) {
    (void)close(tombstone);
    return -1;
  }
  if (unlinkat(STAGING_FD, tombstone_name, AT_REMOVEDIR) != 0) {
    (void)close(tombstone);
    return -1;
  }
  struct stat root_after;
  struct stat tombstone_absent;
  errno = 0;
  int root_removed = fstat(tombstone, &root_after) == 0 &&
      root_after.st_ino == root_before.st_ino &&
      root_after.st_dev == root_before.st_dev &&
      removed_directory_nlink_matches(&root_empty, &root_after) &&
      fstatat(STAGING_FD, tombstone_name, &tombstone_absent,
              AT_SYMLINK_NOFOLLOW) != 0 && errno == ENOENT &&
      validate_cleanup_directory_names(
          &(cleanup_plan){.entries = NULL, .count = 0, .capacity = 0},
          STAGING_FD, SIZE_MAX) == 0;
  (void)close(tombstone);
  if (!root_removed) {
    errno = ESTALE;
    return -1;
  }
#if defined(DA5_V5_TEST_BUILD)
  cleanup_stage = 0;
#endif
  return 0;
}

static int probe_waitid_wnowait(void) {
  pid_t child = fork();
  if (child < 0) {
    return -1;
  }
  if (child == 0) {
    _exit(17);
  }
  siginfo_t first;
  do {
    if (wait_nonreaping(child, &first) != 0) {
      (void)kill(child, SIGKILL);
      (void)waitpid(child, NULL, 0);
      return -1;
    }
  } while (first.si_pid == 0);
  siginfo_t second;
  if (wait_nonreaping(child, &second) != 0 ||
      second.si_pid != child ||
      first.si_status != 17 ||
      second.si_status != 17) {
    (void)kill(child, SIGKILL);
    (void)waitpid(child, NULL, 0);
    return -1;
  }
  int status = 0;
  return reap_exact_child(child, &status) == 0 &&
         WIFEXITED(status) && WEXITSTATUS(status) == 17 ? 0 : -1;
}

static int probe_namespace(const char *nonce) {
  char source[128];
  char target[128];
  (void)snprintf(source, sizeof(source), ".da5-probe-source-%s", nonce);
  (void)snprintf(target, sizeof(target), ".da5-probe-target-%s", nonce);
  if (mkdirat(STAGING_FD, source, 0700) != 0 ||
      mkdirat(STAGING_FD, target, 0700) != 0) {
    return -1;
  }
  struct stat source_before, target_before;
  errno = 0;
  int replacement = rename_exclusive(STAGING_FD, source, target);
  int rejected = replacement != 0 && errno == EEXIST &&
      fstatat(STAGING_FD, source, &source_before, AT_SYMLINK_NOFOLLOW) == 0 &&
      fstatat(STAGING_FD, target, &target_before, AT_SYMLINK_NOFOLLOW) == 0 &&
      S_ISDIR(source_before.st_mode) && S_ISDIR(target_before.st_mode) &&
      source_before.st_ino != target_before.st_ino;
  if (!rejected) {
    return -1;
  }
  if (unlinkat(STAGING_FD, source, AT_REMOVEDIR) != 0 ||
      unlinkat(STAGING_FD, target, AT_REMOVEDIR) != 0) {
    return -1;
  }
  return 0;
}

static int exact_command(const char *frame, const char *name,
                         const char *capability) {
  char expected[256];
  (void)snprintf(expected, sizeof(expected), "%s|%s", name, capability);
  return strcmp(frame, expected) == 0;
}

static void digest_manifest_fields(const char *const *fields, size_t count,
                                   char output[65]) {
  sha256_context digest;
  sha256_initialize(&digest);
  for (size_t index = 0; index < count; index += 1) {
    sha256_update(&digest, (const unsigned char *)fields[index],
                  strlen(fields[index]));
    const unsigned char separator = 0;
    sha256_update(&digest, &separator, 1);
  }
  sha256_finish(&digest, output);
}

static int safe_binary_state(const struct stat *state) {
  return S_ISREG(state->st_mode) && state->st_nlink >= 1 &&
      (state->st_uid == 0 || state->st_uid == geteuid()) &&
      (state->st_mode & 0022) == 0;
}

static int same_binary_state(const struct stat *left,
                             const struct stat *right) {
  return left->st_dev == right->st_dev &&
      left->st_ino == right->st_ino &&
      left->st_uid == right->st_uid &&
      left->st_gid == right->st_gid &&
      left->st_mode == right->st_mode &&
      left->st_size == right->st_size &&
      left->st_nlink == right->st_nlink;
}

static int bind_binary_descriptors(bound_binary_descriptors *binding) {
  const int descriptors[] = {PG_CONFIG_FD, INITDB_FD, POSTGRES_FD};
  for (size_t index = 0; index < 3; index += 1) {
    if (fstat(descriptors[index], &binding->identities[index]) != 0 ||
        !safe_binary_state(&binding->identities[index])) {
      return -1;
    }
  }
  return 0;
}

static int revalidate_binary_descriptors(
    const bound_binary_descriptors *binding) {
  const int descriptors[] = {PG_CONFIG_FD, INITDB_FD, POSTGRES_FD};
  for (size_t index = 0; index < 3; index += 1) {
    struct stat current;
    if (fstat(descriptors[index], &current) != 0 ||
        !safe_binary_state(&current) ||
        !same_binary_state(&binding->identities[index], &current)) {
      return -1;
    }
  }
  return 0;
}

static int same_mount_state(const struct statfs *left,
                            const struct statfs *right) {
#if defined(__APPLE__)
  return memcmp(&left->f_fsid, &right->f_fsid, sizeof(left->f_fsid)) == 0 &&
      strcmp(left->f_mntonname, right->f_mntonname) == 0 &&
      strcmp(left->f_fstypename, right->f_fstypename) == 0 &&
      left->f_bsize == right->f_bsize &&
      left->f_flags == right->f_flags;
#else
  return memcmp(&left->f_fsid, &right->f_fsid, sizeof(left->f_fsid)) == 0 &&
      left->f_type == right->f_type &&
      left->f_bsize == right->f_bsize &&
      left->f_flags == right->f_flags;
#endif
}

static int bind_mount_descriptors(bound_mount_descriptors *binding) {
  if (fstatfs(BASE_FD, &binding->base) != 0 ||
      fstatfs(STAGING_FD, &binding->staging) != 0 ||
      fstatfs(ROOT_FD, &binding->root) != 0 ||
      !same_mount_state(&binding->base, &binding->staging) ||
      !same_mount_state(&binding->staging, &binding->root)) {
    return -1;
  }
  return 0;
}

static int revalidate_mount_descriptors(
    const bound_mount_descriptors *binding) {
  bound_mount_descriptors current;
  return bind_mount_descriptors(&current) == 0 &&
      same_mount_state(&binding->base, &current.base) &&
      same_mount_state(&binding->staging, &current.staging) &&
      same_mount_state(&binding->root, &current.root) ? 0 : -1;
}

static int mount_state_record(const struct statfs *mount, char *output,
                              size_t output_capacity) {
  char fsid_hex[(sizeof(mount->f_fsid) * 2) + 1];
  hex_encode((const unsigned char *)&mount->f_fsid,
             sizeof(mount->f_fsid), fsid_hex);
#if defined(__APPLE__)
  char mount_point_hex[(sizeof(mount->f_mntonname) * 2) + 1];
  char filesystem_type_hex[(sizeof(mount->f_fstypename) * 2) + 1];
  hex_encode((const unsigned char *)mount->f_mntonname,
             strlen(mount->f_mntonname), mount_point_hex);
  hex_encode((const unsigned char *)mount->f_fstypename,
             strlen(mount->f_fstypename), filesystem_type_hex);
  long long filesystem_type = 0;
#else
  const char mount_point_hex[] = "";
  const char filesystem_type_hex[] = "";
  long long filesystem_type = (long long)mount->f_type;
#endif
  int length = snprintf(
      output, output_capacity,
      "fsid=%s,type=%lld,bsize=%lld,flags=%llu,mnton=%s,fstype=%s",
      fsid_hex, filesystem_type, (long long)mount->f_bsize,
      (unsigned long long)mount->f_flags, mount_point_hex,
      filesystem_type_hex);
  if (length <= 0 || (size_t)length >= output_capacity) {
    errno = EOVERFLOW;
    return -1;
  }
  return 0;
}

static int mount_binding_record(
    const bound_mount_descriptors *binding, char *record,
    size_t record_capacity, char digest_output[65]) {
  char base[1024], staging[1024], root[1024];
  if (mount_state_record(&binding->base, base, sizeof(base)) != 0 ||
      mount_state_record(&binding->staging, staging, sizeof(staging)) != 0 ||
      mount_state_record(&binding->root, root, sizeof(root)) != 0) {
    return -1;
  }
  int length = snprintf(
      record, record_capacity,
      "DA5-V5-MOUNT-BINDING-V2\nbase:%s\nstaging:%s\nroot:%s\n",
      base, staging, root);
  if (length <= 0 || (size_t)length >= record_capacity) {
    errno = EOVERFLOW;
    return -1;
  }
  sha256_context digest;
  sha256_initialize(&digest);
  sha256_update(&digest, (const unsigned char *)record, (size_t)length);
  sha256_finish(&digest, digest_output);
  return 0;
}

int main(void) {
  (void)umask(077);
  if (isatty(CONTROL_FD) || isatty(EVENT_FD) || isatty(SECRET_FD) ||
      getsid(0) != getpid() || getpgrp() != getpid()) {
    return 70;
  }
  (void)signal(SIGINT, SIG_IGN);
  (void)signal(SIGTERM, SIG_IGN);
  (void)signal(SIGHUP, SIG_IGN);
  int descriptors[] = {
      CONTROL_FD, EVENT_FD, SECRET_FD, ROOT_FD, STAGING_FD};
  for (size_t index = 0; index < sizeof(descriptors) / sizeof(descriptors[0]);
       index += 1) {
    if (fcntl(descriptors[index], F_SETFD, FD_CLOEXEC) != 0) {
      return 71;
    }
  }
  pthread_t watchdog;
  watchdog_touch();
  atomic_store(&watchdog_enabled, 1);
  if (pthread_create(&watchdog, NULL, watchdog_main, NULL) != 0) {
    return 72;
  }
  (void)pthread_detach(watchdog);

  unsigned char nonce_bytes[16];
  char nonce[33];
  if (fill_random(nonce_bytes, sizeof(nonce_bytes)) != 0) {
    return 73;
  }
  hex_encode(nonce_bytes, sizeof(nonce_bytes), nonce);
  char hello[256];
  (void)snprintf(hello, sizeof(hello), "HELLO|1|%ld|%ld|%ld|%s|%s",
                 (long)getpid(), (long)getsid(0), (long)getpgrp(), nonce,
#if defined(DA5_V5_TEST_BUILD)
                 "test"
#else
                 "production"
#endif
  );
  if (emit_frame(hello) != 0) {
    return 74;
  }

  char frame[FRAME_LIMIT + 1];
  if (read_frame(frame, sizeof(frame), monotonic_ms() + 5000) != 0) {
    return 75;
  }
  char *save = NULL;
  char *kind = strtok_r(frame, "|", &save);
  char *manifest_nonce = strtok_r(NULL, "|", &save);
  char *capability = strtok_r(NULL, "|", &save);
  char *lifecycle_generation = strtok_r(NULL, "|", &save);
  char *manifest_digest = strtok_r(NULL, "|", &save);
  char *artifact_digest = strtok_r(NULL, "|", &save);
  char *chain_digest = strtok_r(NULL, "|", &save);
  char *configuration_digest = strtok_r(NULL, "|", &save);
  char *mode = strtok_r(NULL, "|", &save);
  char *root_hex = strtok_r(NULL, "|", &save);
  char *tombstone_hex = strtok_r(NULL, "|", &save);
  char *initdb_hex = strtok_r(NULL, "|", &save);
  char *postgres_hex = strtok_r(NULL, "|", &save);
  char *data_hex = strtok_r(NULL, "|", &save);
  char *socket_hex = strtok_r(NULL, "|", &save);
  char *log_hex = strtok_r(NULL, "|", &save);
  char *configuration_hex = strtok_r(NULL, "|", &save);
  char *hba_hex = strtok_r(NULL, "|", &save);
  if (kind == NULL || manifest_nonce == NULL || capability == NULL ||
      lifecycle_generation == NULL || manifest_digest == NULL ||
      artifact_digest == NULL || chain_digest == NULL ||
      configuration_digest == NULL || mode == NULL ||
      root_hex == NULL || tombstone_hex == NULL || initdb_hex == NULL ||
      postgres_hex == NULL || data_hex == NULL || socket_hex == NULL ||
      log_hex == NULL || configuration_hex == NULL || hba_hex == NULL ||
      strtok_r(NULL, "|", &save) != NULL ||
      strcmp(kind, "START_MANIFEST") != 0 ||
      strcmp(manifest_nonce, nonce) != 0 ||
      !is_lower_hex(capability, 64) ||
      !is_lower_hex(lifecycle_generation, 32) ||
      !is_lower_hex(manifest_digest, 64) ||
      !is_lower_hex(artifact_digest, 64) ||
      !is_lower_hex(chain_digest, 64) ||
      !is_lower_hex(configuration_digest, 64)) {
    return 76;
  }
  const char *bound_fields[] = {
      lifecycle_generation, artifact_digest, chain_digest,
      configuration_digest, mode, root_hex, tombstone_hex, initdb_hex,
      postgres_hex, data_hex, socket_hex, log_hex, configuration_hex, hba_hex};
  char actual_manifest_digest[65];
  digest_manifest_fields(
      bound_fields, sizeof(bound_fields) / sizeof(bound_fields[0]),
      actual_manifest_digest);
  if (strcmp(actual_manifest_digest, manifest_digest) != 0) {
    return 76;
  }
  char lifecycle_capability[65];
  (void)memcpy(lifecycle_capability, capability, 64);
  lifecycle_capability[64] = '\0';
  char root_name[256], tombstone_name[256], initdb[2048], postgres[2048];
  char data_directory[2048], socket_directory[2048], log_path[2048];
  char configuration[2048], hba[2048];
  if (hex_decode(root_hex, root_name, sizeof(root_name)) != 0 ||
      hex_decode(tombstone_hex, tombstone_name, sizeof(tombstone_name)) != 0 ||
      hex_decode(initdb_hex, initdb, sizeof(initdb)) != 0 ||
      hex_decode(postgres_hex, postgres, sizeof(postgres)) != 0 ||
      hex_decode(data_hex, data_directory, sizeof(data_directory)) != 0 ||
      hex_decode(socket_hex, socket_directory, sizeof(socket_directory)) != 0 ||
      hex_decode(log_hex, log_path, sizeof(log_path)) != 0 ||
      hex_decode(configuration_hex, configuration, sizeof(configuration)) != 0 ||
      hex_decode(hba_hex, hba, sizeof(hba)) != 0) {
    return 77;
  }
  if (emit_frame("ACK") != 0) {
    return 78;
  }

  if (strcmp(mode, "PROBE_ONLY") == 0) {
#if defined(DA5_V5_TEST_BUILD)
    if (strcmp(root_name, "test-crash-before-probe") == 0) {
      (void)emit_frame("TEST_FORCED_EXIT|0");
      _exit(90);
    }
#endif
    int result = probe_waitid_wnowait() == 0 && probe_namespace(nonce) == 0;
#if defined(DA5_V5_TEST_BUILD)
    if (strcmp(root_name, "test-crash-after-probe") == 0) {
      (void)emit_frame("TEST_FORCED_EXIT|1");
      _exit(91);
    }
#endif
    atomic_store(&watchdog_enabled, 0);
    (void)emit_frame(result ? "PROBE_OK" : "PROBE_FAIL");
    return result ? 0 : 79;
  }
  if (strcmp(mode, "START") != 0) {
    return 80;
  }

  int start_descriptors[] = {
      BASE_FD, PG_CONFIG_FD, INITDB_FD, POSTGRES_FD};
  for (size_t index = 0;
       index < sizeof(start_descriptors) / sizeof(start_descriptors[0]);
       index += 1) {
    if (fcntl(start_descriptors[index], F_SETFD, FD_CLOEXEC) != 0) {
      return 80;
    }
  }
  bound_binary_descriptors binary_binding;
  bound_mount_descriptors mount_binding;
  if (bind_binary_descriptors(&binary_binding) != 0 ||
      bind_mount_descriptors(&mount_binding) != 0 ||
      revalidate_binary_descriptors(&binary_binding) != 0 ||
      revalidate_mount_descriptors(&mount_binding) != 0) {
    return 80;
  }
  char mount_digest[65];
  char mount_record[FRAME_LIMIT / 2];
  char mount_record_hex[FRAME_LIMIT];
  char mount_event[FRAME_LIMIT + 1];
  if (mount_binding_record(
          &mount_binding, mount_record, sizeof(mount_record),
          mount_digest) != 0) {
    return 80;
  }
  hex_encode((const unsigned char *)mount_record, strlen(mount_record),
             mount_record_hex);
  int mount_event_length = snprintf(
      mount_event, sizeof(mount_event), "MOUNT_BINDING|%s|%s",
      mount_digest, mount_record_hex);
  if (mount_event_length <= 0 ||
      (size_t)mount_event_length >= sizeof(mount_event)) {
    return 80;
  }
  if (emit_frame(mount_event) != 0) {
    return 80;
  }
  int initdb_child = spawn_initdb(initdb, data_directory);
  int initdb_status = 0;
  int initdb_result = initdb_child <= 0
      ? 1
      : supervise_initdb((pid_t)initdb_child, &initdb_status);
  if (initdb_result != 0) {
#if defined(DA5_V5_TEST_BUILD)
    char initdb_failure[128];
    (void)snprintf(initdb_failure, sizeof(initdb_failure),
                   "INITDB_FAIL|%d|%d", initdb_result, initdb_status);
    (void)emit_frame(initdb_failure);
#else
    (void)emit_frame("INITDB_FAIL");
#endif
    return 81;
  }
  (void)close(SECRET_FD);
  bound_configuration configuration_binding;
  if (bind_exact_configuration(
          data_directory, configuration, hba, configuration_digest,
          &configuration_binding) != 0) {
    (void)emit_frame("CONFIG_FAIL");
    return 82;
  }
  if (emit_frame("INITDB_OK") != 0) {
    close_configuration(&configuration_binding);
    return 82;
  }
  if (read_frame(frame, sizeof(frame), monotonic_ms() + 5000) != 0 ||
      !exact_command(frame, "CONFIG_READY", lifecycle_capability) ||
      revalidate_configuration(&configuration_binding) != 0 ||
      revalidate_binary_descriptors(&binary_binding) != 0 ||
      revalidate_mount_descriptors(&mount_binding) != 0) {
    close_configuration(&configuration_binding);
    return 83;
  }
  pid_t postgres_child = spawn_postgres(postgres, data_directory, socket_directory,
                                        log_path);
  if (postgres_child <= 0) {
    close_configuration(&configuration_binding);
    (void)emit_frame("POSTGRES_SPAWN_FAIL");
    return 84;
  }
  char spawned[128];
  (void)snprintf(spawned, sizeof(spawned), "POSTGRES_SPAWNED|%ld",
                 (long)postgres_child);
  if (emit_frame(spawned) != 0) {
    siginfo_t spawned_failure_information;
    if (wait_nonreaping(postgres_child, &spawned_failure_information) == 0 &&
        spawned_failure_information.si_pid == 0) {
      (void)kill(postgres_child, SIGINT);
    }
    (void)wait_postgres_stop(postgres_child);
    close_configuration(&configuration_binding);
    return 85;
  }

  int stop_received = 0;
  int early_exit_emitted = 0;
  int configuration_valid = 1;
  int protocol_valid = 1;
#if defined(DA5_V5_TEST_BUILD)
  int test_cleanup_mode = 0;
#else
  const int test_cleanup_mode = 0;
#endif
  long long heartbeat_deadline = monotonic_ms() + HEARTBEAT_LEASE_MS;
  while (!stop_received) {
    watchdog_touch();
    siginfo_t early_information;
    if (wait_nonreaping(postgres_child, &early_information) != 0) {
      protocol_valid = 0;
      stop_received = 1;
      break;
    }
    if (early_information.si_pid == postgres_child && !early_exit_emitted) {
      if (emit_frame("POSTGRES_EXITED_EARLY") != 0) {
        protocol_valid = 0;
        stop_received = 1;
        break;
      }
      early_exit_emitted = 1;
    }
    if (read_frame(frame, sizeof(frame), heartbeat_deadline) != 0) {
      protocol_valid = 0;
      stop_received = 1;
      break;
    }
    if (exact_command(frame, "HEARTBEAT", lifecycle_capability)) {
      if (revalidate_configuration(&configuration_binding) != 0 ||
          revalidate_binary_descriptors(&binary_binding) != 0 ||
          revalidate_mount_descriptors(&mount_binding) != 0) {
        configuration_valid = 0;
        stop_received = 1;
        break;
      }
      heartbeat_deadline = monotonic_ms() + HEARTBEAT_LEASE_MS;
      continue;
    }
#if defined(DA5_V5_TEST_BUILD)
    if (exact_command(
            frame, "TEST_PAUSE_CLEANUP", lifecycle_capability)) {
      test_cleanup_mode = 1;
      if (emit_frame("TEST_CLEANUP_PAUSE_ARMED") != 0) {
        protocol_valid = 0;
        stop_received = 1;
        break;
      }
      continue;
    }
    if (exact_command(
            frame, "TEST_MISMATCH_MOUNT_CLEANUP",
            lifecycle_capability)) {
      test_cleanup_mode = 2;
      if (emit_frame("TEST_CLEANUP_MOUNT_MISMATCH_ARMED") != 0) {
        protocol_valid = 0;
        stop_received = 1;
        break;
      }
      continue;
    }
    const char *test_crash_commands[] = {
        "TEST_CRASH_BEFORE_RENAME",
        "TEST_CRASH_AFTER_RENAME",
        "TEST_CRASH_AFTER_INVENTORY",
        "TEST_CRASH_AFTER_FINAL_VALIDATION",
        "TEST_CRASH_AFTER_ONE_UNLINK"};
    int crash_command_matched = 0;
    for (size_t crash_index = 0;
         crash_index < sizeof(test_crash_commands) /
             sizeof(test_crash_commands[0]);
         crash_index += 1) {
      if (exact_command(
              frame, test_crash_commands[crash_index],
              lifecycle_capability)) {
        test_cleanup_mode = (int)crash_index + 3;
        crash_command_matched = 1;
        char armed[96];
        (void)snprintf(
            armed, sizeof(armed), "TEST_CLEANUP_CRASH_ARMED|%zu",
            crash_index + 1);
        if (emit_frame(armed) != 0) {
          protocol_valid = 0;
          stop_received = 1;
        }
        break;
      }
    }
    if (crash_command_matched) {
      continue;
    }
#endif
    if (exact_command(frame, "STOP_FAST", lifecycle_capability)) {
      stop_received = 1;
      break;
    }
    protocol_valid = 0;
    stop_received = 1;
  }

  if (revalidate_configuration(&configuration_binding) != 0 ||
      revalidate_binary_descriptors(&binary_binding) != 0 ||
      revalidate_mount_descriptors(&mount_binding) != 0) {
    close_configuration(&configuration_binding);
    atomic_store(&watchdog_enabled, 0);
    (void)emit_frame("CLEANUP_PRESERVED");
    for (;;) {
      (void)pause();
    }
  }
  siginfo_t postgres_information;
  if (wait_nonreaping(postgres_child, &postgres_information) != 0) {
    close_configuration(&configuration_binding);
    return 86;
  }
  if (postgres_information.si_pid == 0) {
    if (kill(postgres_child, SIGINT) != 0) {
      close_configuration(&configuration_binding);
      return 87;
    }
  }
  int stop_result = wait_postgres_stop(postgres_child);
  if (stop_result == 1) {
    atomic_store(&watchdog_enabled, 0);
    (void)emit_frame("POSTGRES_TIMEOUT_PRESERVED");
    for (;;) {
      (void)pause();
    }
  }
  if (stop_result != 0) {
    close_configuration(&configuration_binding);
    return 88;
  }
  if (revalidate_configuration(&configuration_binding) != 0) {
    configuration_valid = 0;
  }
  if (!configuration_valid || !protocol_valid) {
    close_configuration(&configuration_binding);
    atomic_store(&watchdog_enabled, 0);
    (void)emit_frame("CLEANUP_PRESERVED");
    return 88;
  }
  if (emit_frame("POSTGRES_REAPED") != 0) {
    close_configuration(&configuration_binding);
    return 88;
  }
  close_configuration(&configuration_binding);
  if (cleanup_root(
          root_name, tombstone_name, &mount_binding, &binary_binding,
          test_cleanup_mode, lifecycle_capability) != 0) {
#if defined(DA5_V5_TEST_BUILD)
    char cleanup_failure[128];
    (void)snprintf(cleanup_failure, sizeof(cleanup_failure),
                   "CLEANUP_PRESERVED|%d|%d", errno, cleanup_stage);
    (void)emit_frame(cleanup_failure);
#else
    (void)emit_frame("CLEANUP_PRESERVED");
#endif
    return 89;
  }
  atomic_store(&watchdog_enabled, 0);
  (void)emit_frame("CLEANUP_OK");
  return 0;
}
