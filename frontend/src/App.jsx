import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { apiRequest, clearToken, getToken, setToken } from "./utils/api";
import { decryptPrivateContact, encryptPrivateContact } from "./utils/cryptoContacts";

const emptyDraft = () => ({
  title: "",
  organization: "",
  phone: "",
  email: "",
  address: "",
  website: "",
  notes: "",
  tagsText: ""
});

function draftToPayload(draft) {
  return {
    title: draft.title.trim(),
    organization: draft.organization.trim(),
    phone: draft.phone.trim(),
    email: draft.email.trim(),
    address: draft.address.trim(),
    website: draft.website.trim(),
    notes: draft.notes.trim(),
    tags: draft.tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  };
}

function contactToDraft(contact) {
  if (!contact) {
    return emptyDraft();
  }

  return {
    title: contact.title || "",
    organization: contact.organization || "",
    phone: contact.phone || "",
    email: contact.email || "",
    address: contact.address || "",
    website: contact.website || "",
    notes: contact.notes || "",
    tagsText: Array.isArray(contact.tags) ? contact.tags.join(", ") : ""
  };
}

function displayTitle(contact) {
  return contact.title || contact.organization || contact.email || "Sans titre";
}

function ProtectedRoute({ children }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: { email, password },
        skipAuth: true
      });
      setToken(data.token);
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="eyebrow">con / contacts</div>
        <h1>Connexion</h1>
        <p>
          Contacts publics en clair, contacts prives chiffres cote navigateur. Le token JWT est stocke
          dans <code>localStorage</code> sous <code>con.jwt</code>.
        </p>
        <form onSubmit={handleSubmit} className="stack">
          <label>
            <span>Email ou username</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            <span>Mot de passe</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error ? <div className="banner error">{error}</div> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? "Connexion..." : "Entrer"}
          </button>
        </form>
      </section>
    </main>
  );
}

function ContactsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [publicContacts, setPublicContacts] = useState([]);
  const [privateContacts, setPrivateContacts] = useState([]);
  const [privatePlaintext, setPrivatePlaintext] = useState({});
  const [activeScope, setActiveScope] = useState("public");
  const [selectedIds, setSelectedIds] = useState({ public: "new", private: null });
  const [draft, setDraft] = useState(emptyDraft());
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [vaultSecretInput, setVaultSecretInput] = useState("");
  const [vaultSecret, setVaultSecret] = useState("");
  const [vaultError, setVaultError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [{ user: me }, publicData, privateData] = await Promise.all([
          apiRequest("/api/auth/me"),
          apiRequest("/api/public-contacts"),
          apiRequest("/api/private-contacts")
        ]);

        if (cancelled) {
          return;
        }

        setUser(me);
        setPublicContacts(publicData);
        setPrivateContacts(privateData);
        setSelectedIds({
          public: publicData[0]?.id || "new",
          private: privateData[0]?.id || "new"
        });
      } catch (loadError) {
        if (!cancelled) {
          setFlash(loadError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFlash("");
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [flash]);

  const enrichedPrivateContacts = privateContacts.map((contact) => ({
    ...contact,
    decrypted: privatePlaintext[contact.id] || null
  }));
  const combinedContacts = [
    ...publicContacts.map((contact) => ({ ...contact, scope: "public" })),
    ...enrichedPrivateContacts.map((contact) => ({ ...contact, scope: "private" }))
  ].sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at));
  const allTags = [...new Set(publicContacts.flatMap((contact) => contact.tags || []))].sort((left, right) =>
    left.localeCompare(right)
  );
  const normalizedSearch = search.trim().toLowerCase();

  function matchesPublicContact(contact) {
    const haystack = [
      contact.title,
      contact.organization,
      contact.phone,
      contact.email,
      contact.address,
      contact.website,
      contact.notes,
      ...(contact.tags || [])
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch = !normalizedSearch || haystack.includes(normalizedSearch);
    const matchesTag = !tagFilter || (contact.tags || []).includes(tagFilter);
    return matchesSearch && matchesTag;
  }

  function matchesPrivateContact(contact) {
    if (!vaultSecret) {
      return true;
    }

    const data = contact.decrypted || {};
    const haystack = [
      data.title,
      data.organization,
      data.phone,
      data.email,
      data.address,
      data.website,
      data.notes,
      ...(data.tags || [])
    ]
      .join(" ")
      .toLowerCase();

    return !normalizedSearch || haystack.includes(normalizedSearch);
  }

  const filteredContacts =
    activeScope === "all"
      ? combinedContacts.filter((contact) =>
          contact.scope === "public" ? matchesPublicContact(contact) : matchesPrivateContact(contact)
        )
      : activeScope === "public"
        ? publicContacts.filter(matchesPublicContact)
        : enrichedPrivateContacts.filter(matchesPrivateContact);

  const selectedId = activeScope === "all" ? null : selectedIds[activeScope];
  const selectedPublicContact = publicContacts.find((contact) => contact.id === selectedId) || null;
  const selectedPrivateContact = privateContacts.find((contact) => contact.id === selectedId) || null;
  const selectedPrivateDecrypted = privatePlaintext[selectedId] || null;
  const selectedContact = activeScope === "public" ? selectedPublicContact : selectedPrivateContact;

  useEffect(() => {
    if (selectedId === "new") {
      setDraft(emptyDraft());
      return;
    }

    if (activeScope === "all") {
      return;
    }

    if (activeScope === "public") {
      setDraft(contactToDraft(selectedPublicContact));
      return;
    }

    if (vaultSecret && selectedPrivateDecrypted) {
      setDraft(contactToDraft(selectedPrivateDecrypted));
      return;
    }

    setDraft(emptyDraft());
  }, [activeScope, selectedId, selectedPublicContact, selectedPrivateDecrypted, vaultSecret]);

  function selectContact(scope, contactId) {
    setSelectedIds((current) => ({ ...current, [scope]: contactId }));
    setActiveScope(scope);
    setFlash("");
  }

  function startNew(scope) {
    setActiveScope(scope);
    setSelectedIds((current) => ({ ...current, [scope]: "new" }));
    setDraft(emptyDraft());
    setFlash("");
  }

  async function unlockVault() {
    if (!vaultSecretInput) {
      setVaultError("Saisis un secret de coffre pour dechiffrer les contacts prives.");
      return;
    }

    try {
      const entries = await Promise.all(
        privateContacts.map(async (contact) => [contact.id, await decryptPrivateContact(contact, vaultSecretInput)])
      );

      setPrivatePlaintext(Object.fromEntries(entries));
      setVaultSecret(vaultSecretInput);
      setVaultError("");
      setFlash("Coffre prive decrypte localement.");
      setSelectedIds((current) => ({
        ...current,
        private: current.private || privateContacts[0]?.id || "new"
      }));
    } catch (error) {
      setVaultError("Impossible de dechiffrer le coffre prive avec ce secret.");
      setVaultSecret("");
      setPrivatePlaintext({});
    }
  }

  function lockVault() {
    setVaultSecret("");
    setPrivatePlaintext({});
    setVaultSecretInput("");
    setVaultError("");
    if (activeScope === "private" && selectedIds.private !== "new") {
      setDraft(emptyDraft());
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);

    try {
      if (activeScope === "public") {
        const payload = draftToPayload(draft);
        const isNew = selectedIds.public === "new";
        const result = await apiRequest(
          isNew ? "/api/public-contacts" : `/api/public-contacts/${selectedIds.public}`,
          {
            method: isNew ? "POST" : "PUT",
            body: payload
          }
        );

        const next = isNew
          ? [result, ...publicContacts]
          : publicContacts.map((contact) => (contact.id === result.id ? result : contact));

        setPublicContacts(next);
        setSelectedIds((current) => ({ ...current, public: result.id }));
        setFlash(isNew ? "Contact public cree." : "Contact public mis a jour.");
      } else {
        if (!vaultSecret) {
          throw new Error("Deverrouille le coffre prive avant d'enregistrer.");
        }

        const plaintext = draftToPayload(draft);
        const encrypted = await encryptPrivateContact(plaintext, vaultSecret);
        const isNew = selectedIds.private === "new";
        const result = await apiRequest(
          isNew ? "/api/private-contacts" : `/api/private-contacts/${selectedIds.private}`,
          {
            method: isNew ? "POST" : "PUT",
            body: encrypted
          }
        );

        const nextContacts = isNew
          ? [result, ...privateContacts]
          : privateContacts.map((contact) => (contact.id === result.id ? result : contact));

        setPrivateContacts(nextContacts);
        setPrivatePlaintext((current) => ({ ...current, [result.id]: plaintext }));
        setSelectedIds((current) => ({ ...current, private: result.id }));
        setFlash(isNew ? "Contact prive chiffre et stocke." : "Contact prive rechiffre.");
      }
    } catch (error) {
      setFlash(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (selectedId === "new") {
      setDraft(emptyDraft());
      return;
    }

    try {
      if (activeScope === "public") {
        await apiRequest(`/api/public-contacts/${selectedIds.public}`, { method: "DELETE" });
        const next = publicContacts.filter((contact) => contact.id !== selectedIds.public);
        setPublicContacts(next);
        setSelectedIds((current) => ({ ...current, public: next[0]?.id || "new" }));
        setFlash("Contact public supprime.");
      } else {
        await apiRequest(`/api/private-contacts/${selectedIds.private}`, { method: "DELETE" });
        const next = privateContacts.filter((contact) => contact.id !== selectedIds.private);
        setPrivateContacts(next);
        setPrivatePlaintext((current) => {
          const clone = { ...current };
          delete clone[selectedIds.private];
          return clone;
        });
        setSelectedIds((current) => ({ ...current, private: next[0]?.id || "new" }));
        setFlash("Contact prive supprime.");
      }
    } catch (error) {
      setFlash(error.message);
    }
  }

  function logout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  const showPrivatePrompt = activeScope === "private" && !vaultSecret;
  const currentTitle =
    activeScope === "all"
      ? "Vue mixte"
      : activeScope === "public"
      ? displayTitle(selectedContact || draftToPayload(draft))
      : selectedPrivateDecrypted
        ? displayTitle(selectedPrivateDecrypted)
        : selectedId === "new"
          ? "Nouveau contact prive"
          : "Contact prive verrouille";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">con / carnet de contacts</div>
          <h1>Contacts</h1>
        </div>
        <div className="topbar-actions">
          <div className="user-badge">{user ? `${user.username} · ${user.email}` : "Chargement..."}</div>
          <button className="button-secondary" onClick={logout}>
            Deconnexion
          </button>
        </div>
      </header>

      {flash ? <div className="toast">{flash}</div> : null}

      <section className="workspace">
        <aside className="sidebar">
          <div className="segment">
            <button
              className={activeScope === "all" ? "segment-active" : ""}
              onClick={() => setActiveScope("all")}
            >
              Tous
            </button>
            <button
              className={activeScope === "public" ? "segment-active" : ""}
              onClick={() => setActiveScope("public")}
            >
              Public
            </button>
            <button
              className={activeScope === "private" ? "segment-active" : ""}
              onClick={() => setActiveScope("private")}
            >
              Prive
            </button>
          </div>

          <label className="searchbox">
            <span>Recherche</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                activeScope === "private"
                  ? "Apres deverrouillage"
                  : activeScope === "all"
                    ? "Publics et prives"
                    : "Nom, tag, email..."
              }
            />
          </label>

          {activeScope === "public" ? (
            <div className="tag-cloud">
              <button className={!tagFilter ? "tag-active" : ""} onClick={() => setTagFilter("")}>
                Sans filtre
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  className={tagFilter === tag ? "tag-active" : ""}
                  onClick={() => setTagFilter(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : null}

          {activeScope === "all" ? (
            <div className="form-grid">
              <button className="button-primary fullwidth" onClick={() => startNew("public")}>
                Nouveau public
              </button>
              <button className="button-secondary fullwidth" onClick={() => startNew("private")}>
                Nouveau prive
              </button>
            </div>
          ) : (
            <button className="button-primary fullwidth" onClick={() => startNew(activeScope)}>
              {activeScope === "public" ? "Nouveau contact public" : "Nouveau contact prive"}
            </button>
          )}

          <div className="list">
            {loading ? <div className="muted">Chargement...</div> : null}
            {!loading && filteredContacts.length === 0 ? <div className="muted">Aucun contact.</div> : null}
            {filteredContacts.map((contact) => {
              const contactScope = contact.scope || activeScope;
              const title =
                contactScope === "public"
                  ? displayTitle(contact)
                  : privatePlaintext[contact.id]
                    ? displayTitle(privatePlaintext[contact.id])
                    : "Contact prive verrouille";

              const meta =
                contactScope === "public"
                  ? [contact.organization, contact.phone, contact.email].filter(Boolean).join(" · ")
                  : privatePlaintext[contact.id]
                    ? [
                        privatePlaintext[contact.id].organization,
                        privatePlaintext[contact.id].phone,
                        privatePlaintext[contact.id].email
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : new Date(contact.updated_at).toLocaleString("fr-CA");

              return (
                <button
                  key={contact.id}
                  className={selectedId === contact.id && activeScope === contactScope ? "list-item active" : "list-item"}
                  onClick={() => selectContact(contactScope, contact.id)}
                >
                  <em className="item-scope">{contactScope === "public" ? "Public" : "Prive"}</em>
                  <strong>{title}</strong>
                  <span>{meta || "Aucune metadonnee visible"}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="detail-panel">
          <div className="detail-header">
            <div>
              <div className="eyebrow">
                {activeScope === "all"
                  ? "vue agregee"
                  : activeScope === "public"
                    ? "espace public"
                    : "coffre prive"}
              </div>
              <h2>{currentTitle}</h2>
            </div>
            {activeScope === "all" ? null : (
              <div className="detail-actions">
                <button className="button-secondary" onClick={handleDelete}>
                  {selectedId === "new" ? "Vider" : "Supprimer"}
                </button>
              </div>
            )}
          </div>

          {activeScope === "private" ? (
            <div className="vault-panel">
              <label>
                <span>Secret de coffre</span>
                <input
                  type="password"
                  value={vaultSecretInput}
                  onChange={(event) => setVaultSecretInput(event.target.value)}
                  placeholder="Jamais envoye au backend"
                />
              </label>
              <button className="button-primary" onClick={vaultSecret ? lockVault : unlockVault}>
                {vaultSecret ? "Verrouiller" : "Deverrouiller"}
              </button>
              {vaultError ? <div className="banner error">{vaultError}</div> : null}
            </div>
          ) : null}

          {activeScope === "all" ? (
            <div className="locked-card">
              <p>La liste combine les contacts publics et prives.</p>
              <p>Clique un element pour ouvrir sa fiche dans son espace dedie.</p>
            </div>
          ) : showPrivatePrompt ? (
            <div className="locked-card">
              <p>
                Les contacts prives sont chiffrés cote frontend avec AES-GCM. Le backend stocke uniquement
                <code>ciphertext</code>, <code>iv</code> et <code>salt</code>.
              </p>
              <p>Deverrouille le coffre pour afficher, creer ou modifier les donnees en clair.</p>
            </div>
          ) : (
            <form className="contact-form" onSubmit={handleSave}>
              <label>
                <span>Nom</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  required={activeScope === "public"}
                />
              </label>
              <label>
                <span>Organisation</span>
                <input
                  value={draft.organization}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, organization: event.target.value }))
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  <span>Telephone</span>
                  <input
                    value={draft.phone}
                    onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                  />
                </label>
                <label>
                  <span>Email</span>
                  <input
                    value={draft.email}
                    onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>
              </div>
              <label>
                <span>Adresse</span>
                <input
                  value={draft.address}
                  onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
                />
              </label>
              <label>
                <span>Site web</span>
                <input
                  value={draft.website}
                  onChange={(event) => setDraft((current) => ({ ...current, website: event.target.value }))}
                />
              </label>
              <label>
                <span>Tags</span>
                <input
                  value={draft.tagsText}
                  onChange={(event) => setDraft((current) => ({ ...current, tagsText: event.target.value }))}
                  placeholder="client, urgent, famille"
                />
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  rows="7"
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                />
              </label>
              <div className="form-footer">
                <button className="button-primary" type="submit" disabled={saving}>
                  {saving ? "Enregistrement..." : activeScope === "public" ? "Sauver" : "Chiffrer et sauver"}
                </button>
              </div>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <ContactsPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
