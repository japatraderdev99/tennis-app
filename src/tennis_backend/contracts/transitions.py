"""Execution lifecycles, independent of scientific eligibility."""

_TRANSITIONS = {
    "asset": frozenset({("importing", "ready"), ("importing", "rejected")}),
    "analysis": frozenset({
        ("queued", "running"), ("queued", "cancelled"),
        ("running", "succeeded"), ("running", "failed"), ("running", "cancelled"),
    }),
}


def can_transition(resource: str, from_state: str, to_state: str) -> bool:
    """Return false for unknown resources/states, self transitions and restarts."""
    if not all(isinstance(item, str) for item in (resource, from_state, to_state)):
        return False
    return (from_state, to_state) in _TRANSITIONS.get(resource, ())
