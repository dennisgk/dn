import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Form, Table } from "react-bootstrap";
import { Link, useSearchParams } from "react-router";
import { apiGet, isPast, type ListRow } from "../api";

export default function ListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const contentParam = searchParams.get("content") || "";

  const [rows, setRows] = useState<ListRow[]>([]);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const data = await apiGet<ListRow[]>("/api/list");
        setRows(data);
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, []);

  const sorted = useMemo(() => {
    const r = [...rows];
    r.sort((a, b) => -1 * a.utc_datetime.localeCompare(b.utc_datetime));
    const l = r.filter(
      (v, ind) => !r.slice(0, ind).some((x) => x.uuid === v.uuid),
    );

    let f = l;
    if (contentParam.trim() !== "") {
      const tokenize = (s: string) =>
        s
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter(Boolean);

      f = l.filter((v) => {
        if (!v.content) return false;

        const wordsInParam = tokenize(contentParam);
        const wordsInContent = tokenize(v.content);

        return wordsInParam.every((paramWord) =>
          wordsInContent.some((contentWord) => contentWord.includes(paramWord)),
        );
      });
    }

    return f;
  }, [rows, contentParam]);

  return (
    <div>
      <h2 className="mb-3">List</h2>

      <Form className="mb-3">
        <Form.Group>
          <Form.Label>Filter by Content (optional)</Form.Label>
          <Form.Control
            value={contentParam}
            placeholder="content..."
            onChange={(e) => {
              const v = e.target.value;
              const next = new URLSearchParams(searchParams);
              if (v.trim()) next.set("content", v);
              else next.delete("content");
              setSearchParams(next);
            }}
          />
        </Form.Group>
      </Form>

      {err && <Alert variant="danger">{err}</Alert>}

      <Table striped bordered hover responsive>
        <thead>
          <tr>
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
