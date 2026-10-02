# Build Log 13: One-Command Startup

**Date:** Oct 2, 2026
**What exists after this entry:** A single `./start.sh` script that starts both the backend and the frontend together. This is a convenience change only; nothing about how the app works was touched.

## The confusion this entry clears up

After switching H2 to file-based storage (build log 12), the laptop was fully shut down overnight. The next morning, the app did not work until the backend was manually restarted with `mvn spring-boot:run`. At first glance this looked like a repeat of the same data-loss bug.

It is not the same bug, and there is no code fix for it, because there is nothing wrong. Build log 12 fixed *data* persistence: the database now lives in a file on disk, so the transactions themselves survive a restart. It never made the *server itself* start automatically. The backend and frontend are both just ordinary processes tied to whatever terminal launched them; Spring Boot does not keep running in the background any more than a text editor does. Turning the computer off stops those processes completely, so they have to be started again afterward, exactly like opening the project back up in an editor. That part was never broken.

## What actually changed

Running two separate terminal commands every time (`mvn spring-boot:run`, then `npm run dev` in another window) is real friction, even though neither process is a bug. `start.sh` was added at the project root to collapse that into one command:

```bash
./start.sh
```

It starts the backend and the frontend in parallel and stops both together on a single Ctrl+C. The README's "Running it locally" section was updated to lead with this, while still documenting the two-terminal version underneath for anyone who wants the processes split apart (easier to read logs from, for example).

## The lesson

Not every "it broke again" is the same bug. Data persistence and process persistence are two different things, and this project had already solved the first one; what remained was ordinary developer-workflow friction, not a regression. Worth remembering the distinction next time something "stops working after a restart": is the data gone, or is it just that nothing is running yet?
