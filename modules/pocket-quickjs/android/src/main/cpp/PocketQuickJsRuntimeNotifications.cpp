#include "PocketQuickJsSources.h"
#include "PocketQuickJsNotificationSnapshot.h"

#define kRunner notificationSnapshotRunner()
#include "PocketQuickJsRuntime.cpp"
#undef kRunner
