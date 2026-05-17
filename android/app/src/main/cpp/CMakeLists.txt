# CMakeLists.txt for Glucore Sibionics JNI Bridge
#
# This is Glucore-owned Android integration code around proprietary Sibionics
# libraries packaged in android/app/src/main/jniLibs/.
#
# PROPRIETARY DEPENDENCY NOTICE:
# The packaged vendor .so files are derived from the Juggluco Sibionics path.
# The bridge loads them dynamically at runtime from the app's nativeLibraryDir
# so missing or mismatched symbols fail as explicit bridge errors instead of
# crashing the process while loading libglucore-sibionics-bridge.so.

cmake_minimum_required(VERSION 3.10.2)

project("glucore-sibionics-bridge")

add_library(glucore-sibionics-bridge SHARED
    glucore_sibionics_bridge.cpp)

target_link_libraries(glucore-sibionics-bridge
    log
    dl)

target_include_directories(glucore-sibionics-bridge PRIVATE
    ${CMAKE_SOURCE_DIR})
