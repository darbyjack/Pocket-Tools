#include "PocketQuickJsSources.h"
#include "PocketQuickJsNotifications.h"

#define kRunner notificationRunner()
#include "PocketQuickJsRuntime.cpp"
#undef kRunner
