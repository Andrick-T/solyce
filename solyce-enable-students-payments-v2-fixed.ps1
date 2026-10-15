$ErrorActionPreference = "Stop"

$target = Join-Path (Get-Location) "client/src/admin/AdminApp.jsx"
if (-not (Test-Path $target)) {
  throw "Run this script from the Solyce repository root. File not found: $target"
}

$content = (Get-Content -Raw -Encoding UTF8 $target).Replace("`r`n", "`n")
$backup = "$target.bak-students-payments-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

$stateAnchor = '  const [instructors, setInstructors] = useState([]);'
$stateInsert = @'
  const [instructors, setInstructors] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [studentStatus, setStudentStatus] = useState("ALL");
  const [paymentStatus, setPaymentStatus] = useState("ALL");
  const [studentQuery, setStudentQuery] = useState("");
  const [studentLoading, setStudentLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [recordBusy, setRecordBusy] = useState(null);
'@
if (-not $content.Contains($stateAnchor)) { throw "Could not find instructor state anchor. No changes applied." }
$content = $content.Replace($stateAnchor, $stateInsert)

$functionAnchor = '  async function logout() {'
$functionInsert = @'
  const loadEnrollments = useCallback(async () => {
    if (!user) return;
    setStudentLoading(true);
    try {
      const result = await request(`/admin/enrollments?status=${encodeURIComponent(studentStatus)}`);
      setEnrollments(result.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setStudentLoading(false);
    }
  }, [user, studentStatus]);

  const loadPayments = useCallback(async () => {
    if (!user) return;
    setPaymentLoading(true);
    try {
      const result = await request(`/admin/payments?status=${encodeURIComponent(paymentStatus)}`);
      const rows = result.data || [];
      setPayments(rows);
      setPaymentDrafts((current) => {
        const next = { ...current };
        for (const p of rows) {
          if (!next[p.id]) {
            next[p.id] = {
              method: p.method || "OTHER",
              receivedAmountXaf: String(p.receivedAmountXaf ?? 0),
              status: p.status || "PENDING",
              transactionReference: p.transactionReference || "",
              verificationNote: p.verificationNote || "",
            };
          }
        }
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentLoading(false);
    }
  }, [user, paymentStatus]);

  useEffect(() => {
    if (page === "students") loadEnrollments();
  }, [page, loadEnrollments]);

  useEffect(() => {
    if (page === "payments") loadPayments();
  }, [page, loadPayments]);

  async function changeEnrollmentStatus(enrollment, status) {
    setRecordBusy(`enrollment-${enrollment.id}`);
    setError("");
    try {
      await request(`/admin/enrollments/${enrollment.id}/status`, {
        method: "PATCH",
        headers: { Origin: window.location.origin },
        body: JSON.stringify({ status }),
      });
      await Promise.all([loadEnrollments(), loadData()]);
      flash(status === "CONFIRMED"
        ? "Enrollment confirmed."
        : `Enrollment status updated to ${status.replaceAll("_", " ").toLowerCase()}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordBusy(null);
    }
  }

  async function savePayment(payment) {
    const draft = paymentDrafts[payment.id];
    if (!draft) return;
    setRecordBusy(`payment-${payment.id}`);
    setError("");
    try {
      await request(`/admin/payments/${payment.id}`, {
        method: "PATCH",
        headers: { Origin: window.location.origin },
        body: JSON.stringify({
          method: draft.method,
          receivedAmountXaf: Number(draft.receivedAmountXaf),
          status: draft.status,
          transactionReference: draft.transactionReference.trim() || null,
          verificationNote: draft.verificationNote.trim() || null,
        }),
      });
      await Promise.all([loadPayments(), loadEnrollments(), loadData()]);
      flash("Payment record saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setRecordBusy(null);
    }
  }

  async function logout() {
'@
if (-not $content.Contains($functionAnchor)) { throw "Could not find logout function anchor. No changes applied." }
$content = $content.Replace($functionAnchor, $functionInsert)

$navBadge = '              {item.id === "payments" && <span className="nav-soon">SOON</span>}'
$content = $content.Replace($navBadge, '')

$content = $content.Replace(
  '                          ? "Student enrolment workflows are the next implementation milestone."',
  '                          ? "Review guest bookings, manage enrolment status and track learner cohorts."'
)
$content = $content.Replace(
  '                          : "Payment review and verification are the next implementation milestone."}',
  '                          : "Record offline payments, verify full tuition and keep enrolment decisions auditable."}'
)

$studentsOld = @'
          {page === "students" && (
            <section className="admin-panel admin-coming-panel">
              <div className="coming-symbol">
                <Icon name="students" />
              </div>
              <p className="admin-eyebrow">NEXT IMPLEMENTATION MILESTONE</p>
              <h2>Student enrolment, built end to end.</h2>
              <p>
                This area will include learner records, cohort applications,
                enrolment status and payment-linked confirmation. We will
                connect it to the existing Enrollment model rather than create a
                parallel data structure.
              </p>
              <button
                className="admin-button subtle"
                onClick={() => setPage("cohorts")}
              >
                Review cohorts first ↗
              </button>
            </section>
          )}
'@
$studentsNew = @'
          {page === "students" && (
            <section className="admin-panel admin-table-panel">
              <div className="admin-panel-heading">
                <div>
                  <p className="admin-eyebrow">LEARNER RECORDS</p>
                  <h2>Bookings and enrolments <span className="count-pill">{enrollments.length}</span></h2>
                </div>
                <div className="admin-heading-actions">
                  <input className="admin-search" value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)} placeholder="Search name, email or reference…" aria-label="Search learners" />
                  <select className="admin-search" value={studentStatus} onChange={(e) => setStudentStatus(e.target.value)} aria-label="Filter enrolments">
                    <option value="ALL">All statuses</option>
                    {["PENDING", "AWAITING_PAYMENT", "PAYMENT_UNDER_REVIEW", "CONFIRMED", "CANCELLED", "WAITLISTED"].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                  </select>
                  <button className="admin-button subtle" onClick={loadEnrollments} disabled={studentLoading}>↻ Refresh</button>
                </div>
              </div>
              {studentLoading ? <div className="admin-inline-loading"><span className="admin-spinner" /> Loading enrolments…</div> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Learner</th><th>Program / cohort</th><th>Booking</th><th>Tuition</th><th>Payment</th><th>Enrolment status</th><th>Update status</th></tr></thead>
                    <tbody>
                      {enrollments.filter((e) => `${e.student?.fullName || ""} ${e.student?.email || ""} ${e.bookingReference || ""} ${e.cohort?.name || ""} ${e.cohort?.course?.title || ""}`.toLowerCase().includes(studentQuery.toLowerCase())).map((e) => {
                        const latestPayment = e.payments?.[0];
                        return <tr key={e.id}>
                          <td><div className="table-primary">{e.student?.fullName || "Unnamed learner"}</div><div className="table-secondary">{e.student?.email || "No email"}{e.student?.phone ? ` · ${e.student.phone}` : ""}</div></td>
                          <td><div className="table-primary">{e.cohort?.course?.title || "Program unavailable"}</div><div className="table-secondary">{e.cohort?.name || "Cohort unavailable"} · {date(e.cohort?.startDate)}</div></td>
                          <td><div className="table-primary">{e.bookingReference || `SOL-${String(e.id).padStart(6, "0")}`}</div><div className="table-secondary">{date(e.createdAt)}</div></td>
                          <td className="table-money">{money(e.agreedPriceXaf)}</td>
                          <td><span className={`admin-status status-${(latestPayment?.status || "PENDING").toLowerCase()}`}>{(latestPayment?.status || "NO PAYMENT").replaceAll("_", " ")}</span><div className="table-secondary">{latestPayment ? `${money(latestPayment.receivedAmountXaf)} / ${money(latestPayment.expectedAmountXaf)}` : "No payment record"}</div></td>
                          <td><span className={`admin-status status-${String(e.status).toLowerCase()}`}>{String(e.status).replaceAll("_", " ")}</span></td>
                          <td><select className="admin-search" aria-label={`Change status for ${e.student?.fullName || e.id}`} value={e.status} disabled={recordBusy === `enrollment-${e.id}` || e.status === "CANCELLED"} onChange={(ev) => changeEnrollmentStatus(e, ev.target.value)}>
                            {["PENDING", "AWAITING_PAYMENT", "PAYMENT_UNDER_REVIEW", "CONFIRMED", "CANCELLED", "WAITLISTED"].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                          </select>{recordBusy === `enrollment-${e.id}` && <div className="table-secondary">Saving…</div>}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                  {!enrollments.length && <div className="admin-empty">No enrolments found for this status.</div>}
                  {!!enrollments.length && !enrollments.some((e) => `${e.student?.fullName || ""} ${e.student?.email || ""} ${e.bookingReference || ""} ${e.cohort?.name || ""} ${e.cohort?.course?.title || ""}`.toLowerCase().includes(studentQuery.toLowerCase())) && <div className="admin-empty">No enrolments match this search.</div>}
                </div>
              )}
              <p className="admin-form-note">Confirmation is protected by the server: a booking cannot be confirmed until a full payment has been verified. Cancelled enrolments cannot be reopened.</p>
            </section>
          )}
'@
$studentsPattern = '(?s)\s*\{page === "students" && \(\s*<section className="admin-panel admin-coming-panel">.*?</section>\s*\)\}'
$studentsRegex = [regex]::new($studentsPattern)
if (-not $studentsRegex.IsMatch($content)) { throw "Could not identify the Students placeholder structure. No changes applied." }
$content = $studentsRegex.Replace($content, "`n" + $studentsNew.Trim(), 1)

$paymentsNew = @'
          {page === "payments" && (
            <section className="admin-panel admin-table-panel">
              <div className="admin-panel-heading">
                <div><p className="admin-eyebrow">OFFLINE PAYMENT OPERATIONS</p><h2>Payment register <span className="count-pill">{payments.length}</span></h2></div>
                <div className="admin-heading-actions">
                  <select className="admin-search" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} aria-label="Filter payments">
                    <option value="ALL">All statuses</option>
                    {["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "REFUNDED"].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
                  </select>
                  <button className="admin-button subtle" onClick={loadPayments} disabled={paymentLoading}>↻ Refresh</button>
                </div>
              </div>
              {paymentLoading ? <div className="admin-inline-loading"><span className="admin-spinner" /> Loading payments…</div> : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Learner / booking</th><th>Program / cohort</th><th>Required</th><th>Received</th><th>Method</th><th>Reference</th><th>Status</th><th>Verification note</th><th>Action</th></tr></thead>
                    <tbody>
                      {payments.map((p) => {
                        const d = paymentDrafts[p.id] || { method: p.method || "OTHER", receivedAmountXaf: String(p.receivedAmountXaf ?? 0), status: p.status || "PENDING", transactionReference: p.transactionReference || "", verificationNote: p.verificationNote || "" };
                        const setDraft = (key, value) => setPaymentDrafts((old) => ({ ...old, [p.id]: { ...d, [key]: value } }));
                        const busy = recordBusy === `payment-${p.id}`;
                        const refunded = p.status === "REFUNDED";
                        return <tr key={p.id}>
                          <td><div className="table-primary">{p.student?.fullName || "Unnamed learner"}</div><div className="table-secondary">{p.student?.email || "No email"} · {p.bookingReference}</div></td>
                          <td><div className="table-primary">{p.enrollment?.cohort?.course?.title || "Program unavailable"}</div><div className="table-secondary">{p.enrollment?.cohort?.name || "Cohort unavailable"}</div></td>
                          <td className="table-money">{money(p.expectedAmountXaf)}</td>
                          <td><input aria-label={`Amount received for payment ${p.id}`} type="number" min="0" step="1" className="admin-search" value={d.receivedAmountXaf} disabled={busy || refunded} onChange={(e) => setDraft("receivedAmountXaf", e.target.value)} /></td>
                          <td><select aria-label={`Payment method ${p.id}`} className="admin-search" value={d.method} disabled={busy || refunded} onChange={(e) => setDraft("method", e.target.value)}>{[["MTN_MOMO","MTN Mobile Money"],["ORANGE_MONEY","Orange Money"],["BANK_TRANSFER","Bank transfer"],["CASH","Cash"],["OTHER","Other"]].map(([v,label]) => <option key={v} value={v}>{label}</option>)}</select></td>
                          <td><input aria-label={`Transaction reference ${p.id}`} className="admin-search" maxLength="191" value={d.transactionReference} disabled={busy || refunded} onChange={(e) => setDraft("transactionReference", e.target.value)} placeholder="Optional reference" /></td>
                          <td><select aria-label={`Payment status ${p.id}`} className="admin-search" value={d.status} disabled={busy || refunded} onChange={(e) => setDraft("status", e.target.value)}>{["PENDING", "UNDER_REVIEW", "VERIFIED", "REJECTED", "REFUNDED"].map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select><div className="table-secondary">{p.verifiedAt ? `Verified ${date(p.verifiedAt)}` : ""}</div></td>
                          <td><textarea aria-label={`Verification note ${p.id}`} rows="2" maxLength="5000" className="admin-search" value={d.verificationNote} disabled={busy || refunded} onChange={(e) => setDraft("verificationNote", e.target.value)} placeholder="Optional audit note" /></td>
                          <td><button className="admin-button small primary" disabled={busy || refunded || !String(d.receivedAmountXaf).trim() || Number(d.receivedAmountXaf) < 0 || !Number.isInteger(Number(d.receivedAmountXaf))} onClick={() => savePayment(p)}>{busy ? "Saving…" : "Save"}</button>{refunded && <div className="table-secondary">Locked</div>}</td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                  {!payments.length && <div className="admin-empty">No payments found for this status.</div>}
                </div>
              )}
              <p className="admin-form-note">Only mark a payment VERIFIED after checking the funds were received. The server requires the full tuition amount and automatically confirms the linked enrolment when verification succeeds. Refunded records are locked.</p>
            </section>
          )}
'@
$paymentsPattern = '(?s)\s*\{page === "payments" && \(\s*<section className="admin-panel admin-coming-panel">.*?</section>\s*\)\}'
$paymentsRegex = [regex]::new($paymentsPattern)
if (-not $paymentsRegex.IsMatch($content)) { throw "Could not identify the Payments placeholder structure. No changes applied." }
$content = $paymentsRegex.Replace($content, "`n" + $paymentsNew.Trim(), 1)

Copy-Item $target $backup
Set-Content -Path $target -Value $content -Encoding UTF8
Write-Host "Students and Payments pages installed in $target" -ForegroundColor Green
Write-Host "Backup created: $backup"
Write-Host "Next: run npm --prefix client run build and inspect the two admin pages."
