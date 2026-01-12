import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Form, Table } from "react-bootstrap";
import { Link, useSearchParams } from "react-router";
import { apiGet, formatLocal, isPast, type ListRow } from "../api";

export default function ListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const uuidParam = (searchParams.get("uuid") || "").trim();

  const [rows, setRows] = useState<ListRow[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const path = uuidParam
          ? `/api/list?uuid=${encodeURIComponent(uuidParam)}`
          : "/api/list";
        const data = await apiGet<ListRow[]>(path);
        setRows(data);
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, [uuidParam]);

  const sorted = useMemo(() => {
    const r = [...rows];
    r.sort((a, b) => -1 * a.utc_datetime.localeCompare(b.utc_datetime));
    return r;
  }, [rows]);

  return (
    <div>
      <h2 className="mb-3">List</h2>

      <Form className="mb-3">
        <Form.Group>
          <Form.Label>Filter by UUID (optional)</Form.Label>
          <Form.Control
            value={uuidParam}
            placeholder="uuid..."
            onChange={(e) => {
              const v = e.target.value;
              const next = new URLSearchParams(searchParams);
              if (v.trim()) next.set("uuid", v.trim());
              else next.delete("uuid");
              setSearchParams(next);
            }}
          />
        </Form.Group>
      </Form>

      {err && <Alert variant="danger">{err}</Alert>}

      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>When (local)</th>
            <th>When (UTC)</th>
            <th>UUID</th>
            <th>Name</th>
            <th>Content</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, idx) => {
            const past = isPast(r.utc_datetime);
            return (
              <tr
                key={`${r.uuid}:${r.utc_datetime}:${idx}`}
                className={past ? "text-success" : "text-warning"}
              >
                <td>{formatLocal(r.utc_datetime)}</td>
                <td>{r.utc_datetime}</td>
                <td style={{ fontFamily: "monospace" }}>
                  <Link to={`/info?uuid=${encodeURIComponent(r.uuid)}`}>
                    {r.uuid}
                  </Link>
                </td>
                <td>{r.name}</td>
                <td style={{ whiteSpace: "pre-wrap" }}>{r.content}</td>
                <td>
                  <Badge
                    bg={past ? "success" : "warning"}
                    text={past ? "light" : "dark"}
                  >
                    {past ? "passed" : "upcoming"}
                  </Badge>
                </td>
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="text-muted">
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
