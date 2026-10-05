# libg.so resolve estas classes por nome completo no JNI_OnLoad (FindClass) e
# acessa campos/métodos por nome; o R8 não pode remover nem renomear nada aqui.
-keep class tk.glucodata.** { *; }
-keepclasseswithmembernames class * {
    native <methods>;
}
