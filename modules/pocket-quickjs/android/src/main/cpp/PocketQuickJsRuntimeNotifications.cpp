#include "PocketQuickJsProgress.h"

#define kSdk progressSdk()
#define kRunner progressRunner()
#include "PocketQuickJsRuntime.cpp"
#undef kRunner
#undef kSdk