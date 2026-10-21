package com.taptime.lockscreen

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Only the lock-screen capability lives here. Login credentials never enter this file. */
internal class LockScreenStore(context: Context) {
  private val preferences = context.getSharedPreferences("taptime_lock_screen", Context.MODE_PRIVATE)
  private val alias = "taptime.lock-screen.aes.v1"
  private fun key(): SecretKey {
    val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    (store.getKey(alias, null) as? SecretKey)?.let { return it }
    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
      init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256).setUserAuthenticationRequired(false).build())
    }.generateKey()
  }
  fun read(): JSONObject {
    val encoded = preferences.getString("sealed", null) ?: return JSONObject()
    return try {
      val bytes = Base64.decode(encoded, Base64.NO_WRAP)
      require(bytes.size > 28)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes.copyOfRange(0, 12)))
      JSONObject(String(cipher.doFinal(bytes.copyOfRange(12, bytes.size)), Charsets.UTF_8))
    } catch (_: Exception) {
      // Reinstall/restore, invalidated key or corrupt content: never keep an unusable capability.
      erase()
      JSONObject()
    }
  }
  fun erase() {
    preferences.edit().clear().commit()
    // Also destroys any ciphertext left by a failed preference write; this alias is ours alone.
    runCatching { KeyStore.getInstance("AndroidKeyStore").apply { load(null); deleteEntry(alias) } }
  }
  fun write(value: JSONObject) {
    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
    cipher.init(Cipher.ENCRYPT_MODE, key())
    val sealed = cipher.iv + cipher.doFinal(value.toString().toByteArray(Charsets.UTF_8))
    check(preferences.edit().putString("sealed", Base64.encodeToString(sealed, Base64.NO_WRAP)).commit())
  }
}
