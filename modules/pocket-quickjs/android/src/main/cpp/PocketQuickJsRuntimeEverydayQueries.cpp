#include "PocketQuickJsSources.h"
#include "PocketQuickJsEverydayQueries.h"

#define kRunner everydayQueryRunner()
#include "PocketQuickJsRuntime.cpp"
#undef kRunner
