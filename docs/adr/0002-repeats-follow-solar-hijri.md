# 2. Monthly and yearly repeats follow the Solar Hijri calendar

## Status

Accepted

## Context

The user lives by the Afghan Solar Hijri calendar. "Every month on the 6th" should mean the 6th of each Solar Hijri month, whichever language the app is shown in.

## Decision

Monthly and yearly repeat rules are computed in the Solar Hijri calendar in both languages. The anchor day (and month, for yearly rules) comes from the task's due date. When a month is shorter than the anchor day, the occurrence falls on the month's last day, and the following months return to the anchor day.

## Consequences

In English mode a monthly task follows Solar Hijri month lengths, which can look irregular against Gregorian dates. Daily, weekly, weekday and every-n-days rules are calendar-independent.
