#!/usr/bin/env bash
set -euo pipefail

CHECKS='["lint","typecheck","test","pr-policy"]'

ruleset() {
  jq -n --arg name "$1" --argjson include "$2" --argjson methods "$3" --argjson checks "$CHECKS" '{
    name: $name,
    target: "branch",
    enforcement: "active",
    conditions: { ref_name: { include: $include, exclude: [] } },
    bypass_actors: [{ actor_id: 5, actor_type: "RepositoryRole", bypass_mode: "always" }],
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      { type: "required_status_checks", parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: ($checks | map({ context: . }))
      } },
      { type: "pull_request", parameters: {
          required_approving_review_count: 1,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: true,
          allowed_merge_methods: $methods
      } }
    ]
  }'
}

rulesets() {
  ruleset "main"    '["refs/heads/main"]'       '["merge"]'
  ruleset "develop" '["refs/heads/develop"]'    '["merge","squash"]'
  ruleset "release" '["refs/heads/release/**"]' '["squash"]'
}

if [[ "${1:-}" == "--print" ]]; then
  rulesets | jq -s .
  exit 0
fi

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
echo "Applying rulesets to $repo"
rulesets | jq -c . | while IFS= read -r body; do
  name=$(jq -r .name <<<"$body")
  echo "  - $name"
  gh api --method POST "repos/$repo/rulesets" --input - <<<"$body" >/dev/null
done
