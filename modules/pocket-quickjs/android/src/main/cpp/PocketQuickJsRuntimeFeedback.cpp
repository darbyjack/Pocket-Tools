#include "PocketQuickJsSources.h"
#include "PocketQuickJsEverydayQueries.h"
#include "PocketQuickJsFeedback.h"

#define kRunner feedbackRunner()
#include "PocketQuickJsRuntime.cpp"
#undef kRunner
