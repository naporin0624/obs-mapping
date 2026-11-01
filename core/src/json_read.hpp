#pragma once

#include <nlohmann/json.hpp>

#include <cmath>
#include <string>
#include <string_view>

namespace obs_mapping::detail {

using nlohmann::json;

struct Fail {
	std::string message;
};

[[noreturn]] inline void fail(const std::string &path, const std::string &msg)
{
	throw Fail{path + ": " + msg};
}

inline const json &require(const json &obj, const char *key, std::string_view path)
{
	if (!obj.is_object())
		fail(std::string(path), "expected object");
	auto it = obj.find(key);
	if (it == obj.end())
		fail(path.empty() ? std::string(key) : std::string(path) + "." + key, "missing");
	return *it;
}

inline std::string join(const std::string &base, const char *key)
{
	return base.empty() ? std::string(key) : base + "." + key;
}

inline double number(const json &v, const std::string &path)
{
	if (!v.is_number())
		fail(path, "expected number");
	double d = v.get<double>();
	if (!std::isfinite(d))
		fail(path, "expected finite number");
	return d;
}

inline std::string str(const json &v, const std::string &path)
{
	if (!v.is_string())
		fail(path, "expected string");
	return v.get<std::string>();
}

} // namespace obs_mapping::detail
