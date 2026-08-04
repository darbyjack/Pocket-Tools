package com.darbyjack.pockettools.notifications

import androidx.test.ext.junit.runners.AndroidJUnit4
import java.time.ZoneId
import java.time.ZonedDateTime
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class PocketNotificationSchedulerTest {
  private val zone = ZoneId.of("America/Chicago")

  @Test
  fun schedulesDailyReminderLaterTheSameDay() {
    val now = ZonedDateTime.of(2026, 8, 4, 7, 30, 0, 0, zone)
    val expected = ZonedDateTime.of(2026, 8, 4, 8, 15, 0, 0, zone)

    assertEquals(
      expected.toInstant().toEpochMilli(),
      PocketNotificationScheduler.nextDaily(8, 15, now),
    )
  }

  @Test
  fun rollsDailyReminderToTheNextLocalDay() {
    val now = ZonedDateTime.of(2026, 8, 4, 9, 0, 0, 0, zone)
    val expected = ZonedDateTime.of(2026, 8, 5, 8, 15, 0, 0, zone)

    assertEquals(
      expected.toInstant().toEpochMilli(),
      PocketNotificationScheduler.nextDaily(8, 15, now),
    )
  }

  @Test
  fun usesIsoMondayOneForWeeklyReminders() {
    val now = ZonedDateTime.of(2026, 8, 4, 7, 30, 0, 0, zone)
    val expected = ZonedDateTime.of(2026, 8, 10, 8, 15, 0, 0, zone)

    assertEquals(
      expected.toInstant().toEpochMilli(),
      PocketNotificationScheduler.nextWeekly(1, 8, 15, now),
    )
  }

  @Test
  fun rollsPassedSameWeekdayReminderBySevenDays() {
    val now = ZonedDateTime.of(2026, 8, 4, 9, 0, 0, 0, zone)
    val expected = ZonedDateTime.of(2026, 8, 11, 8, 15, 0, 0, zone)

    assertEquals(
      expected.toInstant().toEpochMilli(),
      PocketNotificationScheduler.nextWeekly(2, 8, 15, now),
    )
  }
}
