# Domain glossary

- **Task**: something the user wants to do. Has a title and optionally notes, a due date, a due time, a priority, subtasks, a repeat rule and a reminder.
- **Category**: a named, coloured group of tasks with an emoji (ورزش، دوکان، مطالعه are created on first launch).
- **Inbox**: where tasks without a category live. It is not a category.
- **Subtask**: a one-level checklist item inside a task.
- **Order** (چیدمان): each list, and the dashboard, picks how it is arranged: by time (the default), newest, priority, A–Z, or by hand (manual; not on the dashboard, which mixes categories). Completed tasks always go last, and ties fall back to the time order. The time order shows overdue tasks first, then by due date, due time (untimed last) and priority. Tasks that tie on all of these list the most recently added first, so a new task is never at the end.
- **Overdue**: an open task whose due date is before today.
- **Repeating task**: a task with a repeat rule. Only one **live occurrence** exists at a time; completing it creates the next one from its due date.
- **Projected occurrence**: a future run of a repeating task, computed for views and notifications but never stored.
- **Bedtime summary**: the evening notification listing tomorrow's tasks.
- **Notification plan**: the full list of notifications that should be scheduled right now, computed by the Task Core and applied by the Android adapter.
- **Task Core**: the framework-free module holding all rules; the UI reads it through queries and changes it through commands.
- **Daily category** (کتگوری روزانه): a category shown on the dashboard. A category can be switched off in its editor: its card and its undated tasks then stay off the dashboard, and new tasks in it start without a date. A task of such a category shows on the dashboard once it is given today's date (the «+ امروز» button), and the category's card appears with it.
