cmake_minimum_required(VERSION 3.28...3.30)

if(NOT DEFINED PROJECT_NAME OR PROJECT_NAME STREQUAL "")
  project(obs_mapping_core LANGUAGES CXX)
endif()

include(FetchContent)

if(NOT TARGET nlohmann_json::nlohmann_json)
  set(JSON_BuildTests OFF CACHE INTERNAL "")
  set(JSON_Install OFF CACHE INTERNAL "")
  FetchContent_Declare(
    nlohmann_json
    URL https://github.com/nlohmann/json/archive/refs/tags/v3.11.3.tar.gz
    DOWNLOAD_EXTRACT_TIMESTAMP TRUE
  )
  FetchContent_MakeAvailable(nlohmann_json)
endif()

add_library(obs_mapping_core STATIC src/mapping_json.cpp src/homography.cpp src/selection.cpp)
target_include_directories(obs_mapping_core PUBLIC include)
target_link_libraries(obs_mapping_core PUBLIC nlohmann_json::nlohmann_json)
set_target_properties(
  obs_mapping_core
  PROPERTIES
    CXX_STANDARD 23
    CXX_STANDARD_REQUIRED ON
    CXX_EXTENSIONS OFF
    POSITION_INDEPENDENT_CODE ON
)

option(OBS_MAPPING_TESTS "Build obs_mapping_core tests" OFF)
if(OBS_MAPPING_TESTS)
  enable_testing()
  add_subdirectory(tests)
endif()
