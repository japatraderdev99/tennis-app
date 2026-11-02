"""Public errors contain no paths or native-tool diagnostics."""


class MediaError(Exception):
    def __init__(self, code: str, message: str, *, retryable: bool = False):
        super().__init__(message)
        self.code = code
        self.retryable = retryable

    def to_dict(self) -> dict:
        return {
            "schema_version": "0.1.0",
            "code": self.code,
            "message": str(self),
            "retryable": self.retryable,
            "details": {},
        }
