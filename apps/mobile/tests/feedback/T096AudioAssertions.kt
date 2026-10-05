import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.PI
import kotlin.math.sin
class AudioAttributes { class Builder { fun setUsage(v:Int)=this;fun setContentType(v:Int)=this;fun build()=AudioAttributes() };companion object {const val USAGE_NOTIFICATION_EVENT=1;const val CONTENT_TYPE_SONIFICATION=1} }
class AudioFormat {class Builder {fun setEncoding(v:Int)=this;fun setSampleRate(v:Int)=this;fun setChannelMask(v:Int)=this;fun build()=AudioFormat()};companion object {const val ENCODING_PCM_16BIT=1;const val CHANNEL_OUT_MONO=1}}
class AudioManager {val ringerMode=1;companion object {const val RINGER_MODE_NORMAL=1;const val AUDIO_SESSION_ID_GENERATE=1}}
class AudioTrack(a:AudioAttributes,f:AudioFormat,s:Int,m:Int,id:Int) {
  val state=if(mode=="uninitialized")0 else 1
  fun write(p:ShortArray,o:Int,s:Int):Int {if(mode=="write")throw IllegalStateException();return s}
  fun setVolume(v:Float) {}
  fun play(){played++;check(state==1);if(mode=="play")throw IllegalStateException();if(mode=="interrupt")Thread.currentThread().interrupt()}
  fun release(){released++;if(mode=="release")throw IllegalStateException()}
  companion object {const val MODE_STATIC=1;const val STATE_INITIALIZED=1;var mode="";var played=0;var released=0}
}
class Worker {
  val audioExecutor=Executors.newSingleThreadExecutor()
  fun run(){val audioManager=AudioManager();val toneFrequencies=listOf(440.0);val toneDurations=listOf(24);val toneVolume=0.5
    /* WORKER */
  }
  /* TONE */
}
fun main(){
  val failures=java.util.concurrent.atomic.AtomicInteger()
  Thread.setDefaultUncaughtExceptionHandler {thread,error->if(thread.name=="main")error.printStackTrace() else failures.incrementAndGet()}
  for(mode in listOf("play","write","uninitialized","interrupt","release")){
    AudioTrack.mode=mode;AudioTrack.played=0;AudioTrack.released=0
    val worker=Worker();worker.run();worker.audioExecutor.shutdown();check(worker.audioExecutor.awaitTermination(2,TimeUnit.SECONDS))
    check(failures.get()==0){"uncaught audio exception in $mode"}
    if(mode=="uninitialized")check(AudioTrack.played==0){"played uninitialized track"}
    check(AudioTrack.released==1){"track was not released"}
  }
  println("audio failures contained")
}
