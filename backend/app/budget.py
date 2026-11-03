"""Conservative cumulative reservations. No refunds, automatic reset, or web admin API."""
import argparse
import os
from pathlib import Path
import sqlite3
from contextlib import closing
from uuid import uuid4

from .voice import VoiceUnavailable

DENIED = "Live narration budget is unavailable or exhausted. Use the public mock demo."


class SynthesisBudget:
    def __init__(self, path: str):
        self.path = Path(path).resolve() if path else None

    def connect(self):
        if self.path is None:
            raise VoiceUnavailable(DENIED)
        connection = sqlite3.connect(self.path.as_uri() + "?mode=rw", uri=True, timeout=3)
        connection.execute("PRAGMA synchronous=FULL")
        return connection

    @classmethod
    def configured(cls):
        return cls(os.getenv("TTS_BUDGET_PATH", ""))

    def check(self):
        self._transaction(0, False)

    def reserve(self, characters: int):
        if type(characters) is not int or characters <= 0:
            raise VoiceUnavailable(DENIED)
        self._transaction(characters, True)

    def _transaction(self, characters, charge):
        try:
            with closing(self.connect()) as db:
                db.execute("BEGIN IMMEDIATE")
                row = db.execute("SELECT max_attempts,max_characters,attempts,characters FROM budget WHERE id=1").fetchone()
                if (not row or any(type(n) is not int or n < 0 for n in row)
                        or row[2] >= row[0] or row[3] + max(characters, 1) > row[1]):
                    raise VoiceUnavailable(DENIED)
                if charge:
                    db.execute("UPDATE budget SET attempts=attempts+1,characters=characters+? WHERE id=1", (characters,))
                    db.execute("INSERT INTO reservations VALUES (?, ?, CURRENT_TIMESTAMP)", (str(uuid4()), characters))
                db.commit()
        except (sqlite3.Error, OSError, ValueError):
            raise VoiceUnavailable(DENIED) from None


def initialize(path: str, attempts: int, characters: int):
    if attempts <= 0 or characters <= 0:
        raise ValueError("Budget limits must be positive.")
    target = Path(path)
    # Exclusive creation: cannot reset an existing ledger by rerunning this command.
    descriptor = os.open(target, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(descriptor)
    with sqlite3.connect(target) as db:
        db.executescript("CREATE TABLE budget (id INTEGER PRIMARY KEY CHECK(id=1), max_attempts INTEGER NOT NULL, "
                         "max_characters INTEGER NOT NULL, attempts INTEGER NOT NULL, characters INTEGER NOT NULL);"
                         "CREATE TABLE reservations (id TEXT PRIMARY KEY, characters INTEGER NOT NULL, created TEXT NOT NULL);")
        db.execute("INSERT INTO budget VALUES (1,?,?,0,0)", (attempts, characters))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--path", required=True)
    parser.add_argument("--attempts", required=True, type=int)
    parser.add_argument("--characters", required=True, type=int)
    args = parser.parse_args()
    initialize(args.path, args.attempts, args.characters)
    print("Created a new cumulative budget. Existing ledgers are never reset.")
