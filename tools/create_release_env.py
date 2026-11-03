"""Write private deployment files exclusively; never print generated secrets."""
import argparse
import os
import secrets
from pathlib import Path


def write_private(path, text):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as output:
        output.write(text)


def create(mode, output, proxy_output=None):
    root = Path(__file__).resolve().parents[1]
    text = (root / "deploy" / f"{mode}.env.example").read_text(encoding="utf-8")
    jwt = secrets.token_urlsafe(48)
    token = secrets.token_urlsafe(48)
    for placeholder in ("REPLACE_WITH_A_RANDOM_SECRET_FROM_secrets.token_urlsafe_48",
                        "REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET_FROM_secrets.token_urlsafe_48"):
        text = text.replace(placeholder, jwt)
    text = text.replace("REPLACE_WITH_A_SEPARATE_RANDOM_PROXY_TOKEN", token)
    if mode == "restricted" and not proxy_output:
        raise ValueError("Restricted mode requires a private proxy output path.")
    if proxy_output and Path(proxy_output).exists():
        raise FileExistsError("Proxy file already exists.")
    write_private(output, text)
    if mode == "restricted":
        write_private(proxy_output, f'proxy_set_header X-HauntCast-Live-Access "{token}";\n')
    print("Private configuration created. No secret values were printed. Existing files are never overwritten.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=["public", "restricted"], required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--proxy-output")
    args = parser.parse_args()
    create(args.mode, args.output, args.proxy_output)
