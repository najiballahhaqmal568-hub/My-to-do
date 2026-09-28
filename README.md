# کارهای من · My To-Do

A personal, offline to-do app for Android. Persian/Dari (RTL, Afghan Solar Hijri calendar) by default, English on one switch. No account, no server: data stays on the phone.

## Install on your phone

1. Open the latest release: https://github.com/najiballahhaqmal568-hub/My-to-do/releases/latest
2. Download `my-to-do-<version>.apk` on your Android phone and open it.
3. If Android asks, allow installing apps from your browser or file manager, then tap **Install**.
4. On first use, allow notifications so reminders and the bedtime summary can arrive.

Newer releases install over the old one and keep your tasks. The app itself tells you when a new version is out.

## What it does

- **Dashboard**: today's progress ring, a card per category (ورزش، دوکان، مطالعه and your own), today's tasks with overdue ones first, and a preview of tomorrow.
- **Tasks**: notes, due date and time, priority, subtasks, a category or the Inbox, repeats (daily, weekly, monthly, yearly, specific weekdays, every n days) and one reminder.
- **Bedtime summary**: every evening (22:00 by default) a notification lists tomorrow's tasks.
- **Upcoming** (next 7 days), **search** with filters, **undo** after delete or complete, **backup** export and import.
- Bold card design with spring animations, swipe to complete, haptics and a celebration when the day is done. Dark mode follows the phone.

## Development

```bash
npm ci
npm run dev            # web preview at http://localhost:5173
npm test               # Task Core unit tests (Vitest)
npm run build && npx playwright test   # end-to-end tests
npm run android:sync   # copy the web build into the Android project
```

- `src/core`: the **Task Core**, every rule of the app, framework-free and fully unit-tested.
- `src/i18n`: translations and Afghan Solar Hijri date formatting.
- `src/platform`: IndexedDB storage, Android notifications, haptics, sharing, update check.
- `src/ui`: React screens and components.
- `android/`: the Capacitor Android project.

GitHub Actions (`.github/workflows/ci.yml`) runs the tests and builds a signed APK on every push. Pushing to `main`, or running the workflow by hand, publishes it as a GitHub Release.

See `CONTEXT.md` for the domain vocabulary and `docs/adr/` for decisions.
