use fancy_regex::Regex;
use serde::Deserialize;
use std::sync::LazyLock;

/// The permission catalog is shared with the web frontend, which reads the same
/// file via `web/src/utils/permissions.ts`. Both sides must classify a given
/// finish-arg identically, so the matching rules below mirror that module.
const CATALOG_JSON: &str = include_str!("../../../shared/flatpak-permissions.catalog.json");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Safe,
    Caution,
    Sensitive,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum Matcher {
    Exact { value: String },
    Regex { pattern: String },
}

impl Matcher {
    /// Length of the match expression, used as a tie-break after priority.
    fn len(&self) -> usize {
        match self {
            Matcher::Exact { value } => value.len(),
            Matcher::Regex { pattern } => pattern.len(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct CatalogRule {
    id: String,
    priority: i64,
    severity: Severity,
    description: String,
    #[serde(rename = "match")]
    matcher: Matcher,
}

#[derive(Debug, Deserialize)]
struct Catalog {
    permissions: Vec<CatalogRule>,
}

#[derive(Debug)]
pub struct MatchResult {
    /// Asserted on by tests to pin which catalog rule won a tie-break;
    /// production code needs only the severity and description.
    #[cfg_attr(not(test), allow(dead_code))]
    pub rule_id: String,
    pub severity: Severity,
    pub description: String,
    pub permission: String,
}

static RULES: LazyLock<Vec<CatalogRule>> = LazyLock::new(|| {
    serde_json::from_str::<Catalog>(CATALOG_JSON)
        .expect("permission catalog is malformed")
        .permissions
});

static COMPILED_REGEXES: LazyLock<Vec<(usize, Regex)>> = LazyLock::new(|| {
    RULES
        .iter()
        .enumerate()
        .filter_map(|(i, rule)| match &rule.matcher {
            Matcher::Regex { pattern } => Some((
                i,
                Regex::new(pattern)
                    .unwrap_or_else(|e| panic!("catalog rule '{}' has an invalid pattern: {e}", rule.id)),
            )),
            Matcher::Exact { .. } => None,
        })
        .collect()
});

/// Classify a single finish-arg against the shared catalog.
///
/// Exact matches win over regex matches. Within each group the highest
/// priority wins, then the longest match expression, then the lowest rule id.
pub fn classify(permission: &str) -> MatchResult {
    let input = permission.trim();

    let mut exact: Vec<&CatalogRule> = RULES
        .iter()
        .filter(|r| matches!(&r.matcher, Matcher::Exact { value } if value == input))
        .collect();
    if !exact.is_empty() {
        exact.sort_by(|a, b| rank(a, b));
        return build_result(exact[0], &[], input);
    }

    let mut regex_matches: Vec<(&CatalogRule, Vec<(String, String)>)> = Vec::new();
    for (rule_index, regex) in COMPILED_REGEXES.iter() {
        // A backtrack-limit error means we cannot tell whether this rule applies;
        // skipping it lets the arg fall through to a more conservative rule, or to
        // the unknown fallback below, rather than crashing on hostile input.
        let Ok(Some(caps)) = regex.captures(input) else {
            continue;
        };
        let mut captures = Vec::new();
        for name in regex.capture_names().flatten() {
            if let Some(m) = caps.name(name) {
                captures.push((name.to_string(), m.as_str().to_string()));
            }
        }
        regex_matches.push((&RULES[*rule_index], captures));
    }

    if !regex_matches.is_empty() {
        regex_matches.sort_by(|(a, _), (b, _)| rank(a, b));
        let (rule, captures) = &regex_matches[0];
        return build_result(rule, captures, input);
    }

    MatchResult {
        rule_id: "unknown".into(),
        severity: Severity::Caution,
        description: format!("Unknown permission: {input}"),
        permission: input.to_string(),
    }
}

fn rank(a: &CatalogRule, b: &CatalogRule) -> std::cmp::Ordering {
    b.priority
        .cmp(&a.priority)
        .then_with(|| b.matcher.len().cmp(&a.matcher.len()))
        .then_with(|| a.id.cmp(&b.id))
}

fn build_result(rule: &CatalogRule, captures: &[(String, String)], input: &str) -> MatchResult {
    MatchResult {
        rule_id: rule.id.clone(),
        severity: rule.severity,
        description: render_description(&rule.description, captures),
        permission: input.to_string(),
    }
}

/// Empty captures are treated as absent, matching the frontend's truthiness checks.
fn capture<'a>(captures: &'a [(String, String)], key: &str) -> Option<&'a str> {
    captures
        .iter()
        .find(|(k, _)| k == key)
        .map(|(_, v)| v.as_str())
        .filter(|v| !v.is_empty())
}

fn mode_suffix(captures: &[(String, String)]) -> String {
    match capture(captures, "mode") {
        Some("ro") => " (read-only)".into(),
        Some("create") => " with permission to create it if needed".into(),
        _ => String::new(),
    }
}

fn path_suffix(captures: &[(String, String)]) -> String {
    if let Some(subpath) = capture(captures, "subpath") {
        format!(" at {subpath}")
    } else if let Some(run_path) = capture(captures, "run_path") {
        format!(" {run_path}")
    } else {
        String::new()
    }
}

fn device_suffix(captures: &[(String, String)]) -> String {
    match capture(captures, "device") {
        Some(device) => format!(" device {device}"),
        None => String::new(),
    }
}

fn class_suffix(captures: &[(String, String)]) -> String {
    match (capture(captures, "class"), capture(captures, "subclass")) {
        (Some(class), Some(subclass)) => format!(" in USB class {class} subclass {subclass}"),
        (Some(class), None) => format!(" in USB class {class}"),
        _ => String::new(),
    }
}

const XDG_LABELS: [(&str, &str); 11] = [
    ("Desktop", "Desktop"),
    ("Documents", "Documents"),
    ("Downloads", "Downloads"),
    ("Music", "Music"),
    ("Pictures", "Pictures"),
    ("Public", "Public"),
    ("Videos", "Videos"),
    ("Templates", "Templates"),
    ("config", "config"),
    ("cache", "cache"),
    ("data", "data"),
];

fn render_description(template: &str, captures: &[(String, String)]) -> String {
    let mut rendered = template.to_string();
    for (key, label) in XDG_LABELS {
        rendered = rendered.replace(&format!("[{key}]"), label);
    }
    for (key, value) in captures {
        rendered = rendered.replace(&format!("[{key}]"), value);
    }
    for (key, value) in [
        ("mode_suffix", mode_suffix(captures)),
        ("path_suffix", path_suffix(captures)),
        ("device_suffix", device_suffix(captures)),
        ("class_suffix", class_suffix(captures)),
    ] {
        rendered = rendered.replace(&format!("[{key}]"), &value);
    }
    rendered
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_parses_and_every_pattern_compiles() {
        assert!(!RULES.is_empty());
        assert!(!COMPILED_REGEXES.is_empty());
    }

    #[test]
    fn exact_match_wins() {
        let r = classify("--device=all");
        assert_eq!(r.rule_id, "device-all");
        assert_eq!(r.severity, Severity::Sensitive);
        assert_eq!(r.description, "Allows the app to access nearly all hardware devices.");
    }

    #[test]
    fn input_is_trimmed() {
        assert_eq!(classify("  --device=all  ").rule_id, "device-all");
    }

    #[test]
    fn unknown_permission_falls_back_to_caution() {
        let r = classify("--not-a-real-flag");
        assert_eq!(r.rule_id, "unknown");
        assert_eq!(r.severity, Severity::Caution);
        assert_eq!(r.description, "Unknown permission: --not-a-real-flag");
    }

    #[test]
    fn regex_match_renders_mode_suffix() {
        let r = classify("--filesystem=host:ro");
        assert_eq!(r.rule_id, "filesystem-host");
        assert_eq!(r.severity, Severity::Sensitive);
        assert!(r.description.ends_with("(read-only)."), "got: {}", r.description);
    }

    #[test]
    fn regex_match_renders_create_mode_suffix() {
        let r = classify("--filesystem=xdg-config/autostart:create");
        assert!(
            r.description.contains("with permission to create it if needed"),
            "got: {}",
            r.description
        );
    }

    #[test]
    fn regex_match_renders_path_suffix() {
        let r = classify("--filesystem=/var/log");
        assert_eq!(r.rule_id, "filesystem-absolute-var");
        assert_eq!(r.severity, Severity::Sensitive);
        assert!(r.description.contains(" at /log"), "got: {}", r.description);
    }

    #[test]
    fn negative_lookahead_is_honoured() {
        // /run/flatpak and /run/host are excluded from filesystem-absolute-run's
        // subpath group, so they fall through to the generic absolute-path rule.
        assert_eq!(classify("--filesystem=/run/systemd").rule_id, "filesystem-absolute-run");
        assert_ne!(classify("--filesystem=/run/flatpak").rule_id, "filesystem-absolute-run");
    }

    #[test]
    fn higher_priority_rule_beats_generic_fallback() {
        // --filesystem=/sys matches both filesystem-absolute-sys (sensitive) and
        // filesystem-absolute-generic (caution); priority must pick the former.
        let r = classify("--filesystem=/sys");
        assert_eq!(r.rule_id, "filesystem-absolute-sys");
        assert_eq!(r.severity, Severity::Sensitive);
    }

    #[test]
    fn safe_permissions_are_not_flagged() {
        for arg in ["--share=ipc", "--socket=wayland"] {
            assert_ne!(classify(arg).severity, Severity::Sensitive, "arg: {arg}");
        }
    }

    /// Mirrored by the same table in web/src/utils/permissions.test.ts. If the two
    /// readers of the catalog ever diverge, one of the two will fail.
    #[test]
    fn shared_fixture_matches_frontend() {
        let cases: [(&str, &str, Severity); 12] = [
            ("--share=ipc", "share-ipc", Severity::Safe),
            ("--share=network", "share-network", Severity::Caution),
            ("--socket=wayland", "socket-wayland", Severity::Safe),
            ("--socket=fallback-x11", "socket-fallback-x11", Severity::Caution),
            ("--socket=pulseaudio", "socket-pulseaudio", Severity::Caution),
            ("--socket=session-bus", "socket-session-bus", Severity::Sensitive),
            ("--socket=system-bus", "socket-system-bus", Severity::Sensitive),
            ("--device=all", "device-all", Severity::Sensitive),
            ("--device=dri", "device-dri", Severity::Safe),
            ("--filesystem=host", "filesystem-host", Severity::Sensitive),
            ("--filesystem=home", "filesystem-home", Severity::Sensitive),
            ("--allow=devel", "allow-devel", Severity::Sensitive),
        ];
        for (arg, expected_id, expected_severity) in cases {
            let r = classify(arg);
            assert_eq!(r.rule_id, expected_id, "rule for {arg}");
            assert_eq!(r.severity, expected_severity, "severity for {arg}");
        }
    }
}
