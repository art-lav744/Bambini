import os
import tempfile
from pathlib import Path


TEST_ROOT = Path(tempfile.mkdtemp(prefix="bambini-tests-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(TEST_ROOT / 'test_app.db').as_posix()}"
os.environ["MEDIA_ROOT"] = str(TEST_ROOT / "media")
os.environ["GOOGLE_CLIENT_ID"] = "test-google-client"
os.environ["CORS_ORIGINS"] = "http://testserver"
