import itertools

import pytest

from tennis_backend.contracts import can_transition


ALLOWED = {
    "asset": {("importing", "ready"), ("importing", "rejected")},
    "analysis": {
        ("queued", "running"), ("queued", "cancelled"),
        ("running", "succeeded"), ("running", "failed"), ("running", "cancelled"),
    },
}
STATES = ("importing", "ready", "rejected", "queued", "running", "succeeded", "failed", "cancelled", "deleted", "unknown")


@pytest.mark.parametrize("resource,source,target", itertools.product(ALLOWED, STATES, STATES))
def test_complete_state_matrix(resource, source, target):
    assert can_transition(resource, source, target) is ((source, target) in ALLOWED[resource])


@pytest.mark.parametrize("arguments", [
    ("unknown", "queued", "running"), ("assets", "importing", "ready"),
    (None, "queued", "running"), ([], "queued", "running"),
    ("analysis", {}, "running"), ("analysis", "queued", False),
])
def test_unknown_inputs_return_false(arguments):
    assert can_transition(*arguments) is False
