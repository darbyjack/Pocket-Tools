#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>

namespace pocket_tools::quickjs {

struct SandboxLimits {
  std::size_t maximumSourceBytes;
  std::size_t maximumRequestBytes;
  std::size_t maximumResultBytes;
  std::size_t runtimeMemoryBytes;
  std::size_t runtimeStackBytes;
  std::uint32_t executionTimeoutMilliseconds;
  std::uint32_t maximumLogEntries;
  std::size_t maximumLogBytes;
};

[[nodiscard]] std::string run(
    std::string_view source,
    std::string_view requestJson,
    const SandboxLimits& limits);

}  // namespace pocket_tools::quickjs
