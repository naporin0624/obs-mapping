include(FetchContent)
FetchContent_Declare(
  doctest
  URL https://github.com/doctest/doctest/archive/refs/tags/v2.4.11.tar.gz
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE
  SOURCE_SUBDIR
  doctest_header_only # skip doctest's own (old-policy) CMakeLists
)
FetchContent_MakeAvailable(doctest)
add_library(doctest INTERFACE)
add_library(doctest::doctest ALIAS doctest)
target_include_directories(doctest INTERFACE ${doctest_SOURCE_DIR})

# Add new test files here (one per line).
add_executable(
  obs_mapping_core_tests
  main.cpp
  test_mapping_json.cpp
  test_homography.cpp
  test_draw_rules.cpp
  test_overlay_geometry.cpp
  test_selection.cpp
  test_visibility.cpp
  test_mask.cpp
)
target_link_libraries(obs_mapping_core_tests PRIVATE obs_mapping_core doctest::doctest)
set_target_properties(
  obs_mapping_core_tests
  PROPERTIES CXX_STANDARD 23 CXX_STANDARD_REQUIRED ON CXX_EXTENSIONS OFF
)
add_test(NAME obs_mapping_core_tests COMMAND obs_mapping_core_tests)
