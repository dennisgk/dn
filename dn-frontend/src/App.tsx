import { Container, Nav, Navbar } from "react-bootstrap";
import { Link, Route, Routes } from "react-router";
import ListPage from "./pages/ListPage";
import CreatePage from "./pages/CreatePage";
import InfoPage from "./pages/InfoPage";

export default function App() {
  return (
    <>
      <Navbar bg="dark" data-bs-theme="dark" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">
            Notify Server
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="nav" />
          <Navbar.Collapse id="nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/">
                List
              </Nav.Link>
              <Nav.Link as={Link} to="/create">
                Create
              </Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="py-4">
        <Routes>
          <Route path="/" element={<ListPage />} />
          <Route path="/create" element={<CreatePage />} />
          <Route path="/info" element={<InfoPage />} />
        </Routes>
      </Container>
    </>
  );
}
