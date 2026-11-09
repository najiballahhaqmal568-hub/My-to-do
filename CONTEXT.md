# Domain glossary

- **Task**: something the user wants to do. Has a title and optionally notes, a due date, a due time, a priority, subtasks, a repeat rule and a reminder.
- **Category**: a named, coloured group of tasks with an emoji (ورزش، دوکان، مطالعه are created on first launch).
- **Inbox**: where tasks without a category live. It is not a category.
- **Subtask**: a one-level checklist item inside a task.
- **Order** (چیدمان): each list, and the Today screen, picks how it is arranged: by time (the default), newest, priority, A–Z, or by hand (manual). Arranged by hand, the Today list mixes categories and a task that joins it goes on top. Completed tasks always go last, and ties fall back to the time order. The time order shows overdue tasks first, then by due date, due time (untimed last) and priority. Tasks that tie on all of these list the most recently added first, so a new task is never at the end.
- **Overdue**: an open task whose due date is before today.
- **Repeating task**: a task with a repeat rule. Only one **live occurrence** exists at a time; completing it creates the next one from its due date.
- **Projected occurrence**: a future run of a repeating task, computed for views and notifications but never stored.
- **Bedtime summary**: the evening notification listing tomorrow's tasks.
- **Notification plan**: the full list of notifications that should be scheduled right now, computed by the Task Core and applied by the Android adapter.
- **Task Core**: the framework-free module holding all rules; the UI reads it through queries and changes it through commands.
- **Today** (امروز): the home screen, the one the app opens on, also after it has been away for a minute or more (unless something is being edited). It lists only the tasks the user put there: made on the Today screen, brought with «+ امروز» or «همه به امروز», or switched on in the task editor. A date never brings a task to Today. A task stays until it is done or taken off, so an unfinished one is carried over and is not marked late. The next run of a repeating task starts off Today. It is the dashboard in the code.
- **Daily category** (کتگوری روزانه): a category whose card shows on Today. Switched off in its editor, the card is hidden; its tasks can still be put on Today.
