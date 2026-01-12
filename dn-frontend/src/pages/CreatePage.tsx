import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Form } from "react-bootstrap";
import { useNavigate } from "react-router";
import {
  apiGet,
  apiPost,
  type CreateInfo,
  utcIsoFromDatetimeLocal,
} from "../api";

type CreateResponse =
  | { ok: true; uuid: string }
  | { ok: false; message: string };

export default function CreatePage() {
  const nav = useNavigate();

  const [info, setInfo] = useState<CreateInfo[]>([]);
  const [selectedType, setSelectedType] = useState<string>("");
  const [values, setValues] = useState<any[]>([]);
  const [serverMsg, setServerMsg] = useState<{
    variant: "danger" | "success";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<CreateInfo[]>("/api/create_info");
        setInfo(data);
        if (data.length) {
          setSelectedType(data[0].type);
          setValues(new Array(data[0].arguments.length).fill(""));
        }
      } catch (e: any) {
        setServerMsg({ variant: "danger", text: e?.message || String(e) });
      }
    })();
  }, []);

  const selected = useMemo(
    () => info.find((t) => t.type === selectedType) || null,
    [info, selectedType]
  );

  useEffect(() => {
    if (!selected) return;
    setValues((prev) => {
      const next = new Array(selected.arguments.length).fill("");
      // keep old values when possible
      for (let i = 0; i < Math.min(prev.length, next.length); i++)
        next[i] = prev[i];
      return next;
    });
  }, [selectedType]); // eslint-disable-line react-hooks/exhaustive-deps

  function setAt(i: number, v: any) {
    setValues((old) => {
      const n = [...old];
      n[i] = v;
      return n;
    });
  }

  function clientValidate(): string | null {
    if (!selected) return "No type selected.";
    for (let i = 0; i < selected.arguments.length; i++) {
      const spec = selected.arguments[i];
      const v = values[i];

      if (spec.type === "BOOLEAN") continue;

      if (spec.type === "INTEGER") {
        if (v === "" || v === null || Number.isNaN(Number(v)))
          return `${spec.label} must be an integer.`;
        if (!Number.isInteger(Number(v)))
          return `${spec.label} must be an integer.`;
      } else if (spec.type === "FLOAT") {
        if (v === "" || v === null || Number.isNaN(Number(v)))
          return `${spec.label} must be a number.`;
      } else {
        // TEXT/TEXTAREA/DATETIME
        if (!String(v || "").trim()) return `${spec.label} is required.`;
      }
    }
    return null;
  }

  async function onCreate() {
    setServerMsg(null);
    const err = clientValidate();
    if (err) {
      setServerMsg({ variant: "danger", text: err });
      return;
    }
    if (!selected) return;

    // Build typed args
    const args = selected.arguments.map((spec, i) => {
      const v = values[i];
      switch (spec.type) {
        case "DATETIME":
          // from datetime-local -> UTC ISO
          return utcIsoFromDatetimeLocal(String(v));
        case "INTEGER":
          return Number(v);
        case "FLOAT":
          return Number(v);
        case "BOOLEAN":
          return Boolean(v);
        case "TEXT":
        case "TEXTAREA":
        default:
          return String(v);
      }
    });

    setLoading(true);
    try {
      const resp = await apiPost<CreateResponse>("/api/create", {
        type: selectedType,
        arguments: args,
      });
      if (!resp.ok) {
        setServerMsg({ variant: "danger", text: resp.message });
      } else {
        // redirect to info
        nav(`/info?uuid=${encodeURIComponent(resp.uuid)}`);
      }
    } catch (e: any) {
      setServerMsg({ variant: "danger", text: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="mb-3">Create</h2>

      {serverMsg && <Alert variant={serverMsg.variant}>{serverMsg.text}</Alert>}

      <Card className="mb-3">
        <Card.Body>
          <Form.Group className="mb-3">
            <Form.Label>Notification type</Form.Label>
            <Form.Select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              {info.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.type}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          {selected?.arguments.map((spec, i) => (
            <Form.Group className="mb-3" key={`${selectedType}:${i}`}>
              <Form.Label>{spec.label}</Form.Label>

              {spec.type === "DATETIME" && (
                <Form.Control
                  type="datetime-local"
                  value={String(values[i] ?? "")}
                  onChange={(e) => setAt(i, e.target.value)}
                />
              )}

              {spec.type === "TEXT" && (
                <Form.Control
                  type="text"
                  value={String(values[i] ?? "")}
                  onChange={(e) => setAt(i, e.target.value)}
                />
              )}

              {spec.type === "TEXTAREA" && (
                <Form.Control
                  as="textarea"
                  rows={5}
                  value={String(values[i] ?? "")}
                  onChange={(e) => setAt(i, e.target.value)}
                />
              )}

              {spec.type === "INTEGER" && (
                <Form.Control
                  type="number"
                  step={1}
                  value={String(values[i] ?? "")}
                  onChange={(e) => setAt(i, e.target.value)}
                />
              )}

              {spec.type === "FLOAT" && (
                <Form.Control
                  type="number"
                  step="any"
                  value={String(values[i] ?? "")}
                  onChange={(e) => setAt(i, e.target.value)}
                />
              )}

              {spec.type === "BOOLEAN" && (
                <Form.Check
                  type="checkbox"
                  label="Enabled"
                  checked={Boolean(values[i] ?? false)}
                  onChange={(e) => setAt(i, e.target.checked)}
                />
              )}

              <Form.Text className="text-muted">{spec.desc}</Form.Text>
            </Form.Group>
          ))}

          <Button onClick={onCreate} disabled={loading || !selected}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </Card.Body>
      </Card>
    </div>
  );
}
