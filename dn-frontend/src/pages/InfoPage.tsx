import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Modal, Table } from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router";
import { apiGet, formatLocal, isPast, type ListRow } from "../api";

type InfoResponse = {
  ok: true;
  notification: {
    uuid: string;
    type: string;
    arguments: any[];
    active_status: boolean;
    created_utc: string;
  };
  rows: ListRow[];
};

export default function InfoPage() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const uuid = (sp.get("uuid") || "").trim();

  const [data, setData] = useState<InfoResponse | null>(null);
  const [err, setErr] = useState<string>("");
  const [showDel, setShowDel] = useState(false);
  const [delErr, setDelErr] = useState<string>("");

  useEffect(() => {
    if (!uuid) {
      setErr("Missing required ?uuid=... search param.");
      return;
    }
    (async () => {
      try {
        setErr("");
        const resp = await apiGet<InfoResponse>(
          `/api/info?uuid=${encodeURIComponent(uuid)}`,
        );
        setData(resp);
      } catch (e: any) {
        setErr(e?.message || String(e));
      }
    })();
  }, [uuid]);

  const rows = useMemo(() => {
    const r = data?.rows ? [...data.rows] : [];
    r.sort((a, b) => a.utc_datetime.localeCompare(b.utc_datetime));
    return r;
  }, [data]);

  async function doDelete() {
    setDelErr("");
    try {
      const resp = await apiGet<any>(
        `/api/delete?uuid=${encodeURIComponent(uuid)}`,
      );
      if (!resp?.ok) {
        setDelErr(resp?.message || "Delete failed.");
        return;
      }
      setShowDel(false);
      nav("/");
    } catch (e: any) {
      setDelErr(e?.message || String(e));
    }
  }

  if (err) return <Alert variant="danger">{err}</Alert>;
  if (!data) return <div className="text-muted">Loading...</div>;

  return (
    <div>
      <h2 className="mb-3">Info</h2>

      <Card className="mb-3">
        <Card.Body>
          <div>
            <strong>UUID:</strong>{" "}
            <span style={{ fontFamily: "monospace" }}>
              {data.notification.uuid}
            </span>
          </div>
          <div>
            <strong>Type:</strong> {data.notification.type}
          </div>
          <div>
            <strong>Active:</strong>{" "}
            <Badge
              bg={data.notification.active_status ? "success" : "secondary"}
            >
              {data.notification.active_status ? "true" : "false"}
            </Badge>
          </div>
          <div>
            <strong>Created (UTC):</strong> {data.notification.created_utc}
          </div>
          <div className="mt-2">
            <strong>Arguments:</strong>
            <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(data.notification.arguments, null, 2)}
            </pre>
          </div>

          <div className="mt-3 d-flex gap-2">
            <Button variant="danger" onClick={() => setShowDel(true)}>
              Delete
            </Button>
          </div>
        </Card.Body>
      </Card>

      <h4 className="mb-2">Notifications (rows)</h4>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>When (local)</th>
            <th>When (UTC)</th>
            <th>Name</th>
            <th>Content</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const past = isPast(r.utc_datetime);
            return (
              <tr
                key={`${r.uuid}:${r.utc_datetime}:${idx}`}
                className={past ? "text-success" : "text-warning"}
              >
                <td>{formatLocal(r.utc_datetime)}</td>
                <td>{r.utc_datetime}</td>
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
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="text-muted">
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={showDel} onHide={() => setShowDel(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete notification?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            This will delete from <code>notifications</code> and{" "}
            <code>past_sends</code>.
          </p>
          {delErr && <Alert variant="danger">{delErr}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDel(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={doDelete}>
            Yes, delete
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
