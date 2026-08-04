cmake_minimum_required(VERSION 3.22.1)
project(pocketquickjs LANGUAGES C CXX)

include(FetchContent)

FetchContent_Declare(
  quickjs
  GIT_REPOSITORY https://github.com/quickjs-ng/quickjs.git
  GIT_TAG fd0a0210b7be00957751871e7e01b8291268fc29
)
FetchContent_GetProperties(quickjs)
if (NOT quickjs_POPULATED)
  FetchContent_Populate(quickjs)
endif()

add_library(
  pocketquickjs
  SHARED
  src/main/cpp/PocketQuickJsJni.cpp
  src/main/cpp/PocketQuickJsRuntimeFeedback.cpp
  ${quickjs_SOURCE_DIR}/dtoa.c
  ${quickjs_SOURCE_DIR}/libregexp.c
  ${quickjs_SOURCE_DIR}/libunicode.c
  ${quickjs_SOURCE_DIR}/quickjs.c
)

target_compile_definitions(pocketquickjs PRIVATE _GNU_SOURCE)
target_compile_features(pocketquickjs PRIVATE c_std_11 cxx_std_20)
target_include_directories(
  pocketquickjs
  PRIVATE
  src/main/cpp
  ${quickjs_SOURCE_DIR}
)
target_link_libraries(pocketquickjs PRIVATE android log m)
