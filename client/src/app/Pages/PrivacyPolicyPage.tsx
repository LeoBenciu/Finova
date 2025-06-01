
const PrivacyPolicyPage = () => {
    return (
        <div className="max-w-4xl mx-auto p-6 bg-white overflow-y-scroll max-h-screen">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            🔐 Politica de Confidențialitate – Aplicația Next Corp (Finova)
          </h1>
          <p className="text-sm text-gray-600">
            <strong>Ultima actualizare:</strong> 30.05.2025
          </p>
          <p className="text-gray-700 mt-4 leading-relaxed">
            Această politică descrie modul în care SC Next Corp SRL („Noi", „Operatorul") colectează, utilizează și protejează datele cu caracter personal prin intermediul aplicației software pentru automatizarea proceselor contabile, pusă la dispoziție firmelor de contabilitate.
          </p>
        </div>
  
        {/* Secțiunea 1 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Operator de date</h2>
          <div className="bg-gray-50 rounded-lg p-4">
            <p><strong>SC Next Corp SRL</strong></p>
            <p>Strada Principală nr. 223, sat Pâncești, comuna Pâncești, jud. Bacău, România</p>
            <p><strong>E-mail:</strong> <a href="mailto:nextcorpromania@gmail.com" className="text-blue-600 hover:underline">nextcorpromania@gmail.com</a></p>
            <p><strong>Administrator și responsabil cu protecția datelor (DPO):</strong> Benciu Leonardo-Constantin</p>
          </div>
        </section>
  
        {/* Secțiunea 2 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Ce date colectăm</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">a) Date despre utilizatorii platformei (contabili / firme)</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Nume și prenume</li>
              <li>Adresă de e-mail</li>
              <li>Parolă (criptată)</li>
              <li>Număr de telefon</li>
              <li>Cod unic de înregistrare al firmei (CUI)</li>
              <li>Activitate în aplicație (loguri, sesiuni)</li>
              <li>Documente contabile încărcate (CSV din SAGA: articole, gestiuni etc.)</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">b) Date despre clienții firmelor de contabilitate (date procesate în calitate de împuternicit)</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Facturi de intrare și ieșire</li>
              <li>Extrase bancare</li>
              <li>Documente contabile: bonuri fiscale, chitanțe, deconturi, balanțe, registre etc.</li>
              <li>Date de identificare: denumire firmă, CUI, nume persoane de contact, cont bancar, CNP (dacă apare în documente)</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 3 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Scopul și temeiul legal al prelucrării</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">Scopuri:</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Furnizarea și administrarea serviciului</li>
              <li>Procesarea automată a documentelor contabile</li>
              <li>Importul și structurarea datelor financiare</li>
              <li>Audit și securitate</li>
              <li>Răspuns la solicitări legate de cont</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">Temeiuri legale (art. 6 GDPR):</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li><strong>Executarea contractului</strong> (Art. 6 alin. 1 lit. b)</li>
              <li><strong>Obligație legală</strong> (Art. 6 alin. 1 lit. c) – ex. arhivare contabilă</li>
              <li><strong>Interes legitim</strong> (Art. 6 alin. 1 lit. f) – ex. protecția platformei, prevenirea fraudei</li>
              <li><strong>Consimțământ</strong> (Art. 6 alin. 1 lit. a) – pentru crearea contului și acceptarea termenilor</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 4 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Destinatarii datelor</h2>
          <p className="text-gray-700 mb-4">
            Datele pot fi accesate de furnizori de servicii strict necesari pentru funcționarea aplicației:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li><strong>Render</strong> – găzduire baze de date</li>
            <li><strong>Amazon Web Services (AWS S3)</strong> – stocare documente</li>
            <li><strong>Google (Gmail API)</strong> – trimitere e-mail „resetare parolă"</li>
            <li><strong>ANAF API</strong> – integrare cu surse fiscale oficiale</li>
          </ul>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-blue-800 text-sm">
              Toți acești furnizori respectă obligațiile GDPR ca împuterniciți sau operatori independenți.
            </p>
          </div>
        </section>
  
        {/* Secțiunea 5 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Transferuri internaționale</h2>
          <p className="text-gray-700">
            Stocarea și procesarea datelor are loc, în principal, în Spațiul Economic European (SEE). Dacă unele date sunt transferate în afara SEE (ex. servere AWS sau Google din SUA), aceste transferuri sunt protejate prin clauze contractuale standard (SCC) agreate de Comisia Europeană.
          </p>
        </section>
  
        {/* Secțiunea 6 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Durata păstrării datelor</h2>
          <p className="text-gray-700 mb-3">
            Datele sunt păstrate pe durata utilizării contului și pot fi șterse complet la cererea utilizatorului. Momentan nu există o politică automată de ștergere, dar acest aspect va fi reglementat în versiunile viitoare ale aplicației.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm">
              <strong>Notă:</strong> Backup-urile nu sunt configurate explicit în prezent.
            </p>
          </div>
        </section>
  
        {/* Secțiunea 7 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Drepturile utilizatorilor și ale persoanelor vizate</h2>
          <p className="text-gray-700 mb-4">Conform GDPR, aveți următoarele drepturi:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Dreptul de acces la datele proprii</li>
            <li>Dreptul la rectificare a datelor inexacte</li>
            <li>Dreptul la ștergerea datelor („dreptul de a fi uitat")</li>
            <li>Dreptul la restricționarea prelucrării</li>
            <li>Dreptul la portabilitatea datelor</li>
            <li>Dreptul de opoziție la anumite tipuri de procesare</li>
            <li>Dreptul de retragere a consimțământului (pentru viitoare funcționalități)</li>
          </ul>
          <div className="bg-gray-50 rounded-lg p-4 mt-4">
            <p className="text-gray-700">
              <strong>Solicitările pot fi trimise la:</strong> <a href="mailto:nextcorpromania@gmail.com" className="text-blue-600 hover:underline">nextcorpromania@gmail.com</a>
            </p>
            <p className="text-gray-700 mt-2">
              Vom răspunde în cel mult 30 de zile calendaristice.
            </p>
          </div>
        </section>
  
        {/* Secțiunea 8 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Securitatea datelor</h2>
          <p className="text-gray-700 mb-4">Luăm măsuri tehnice și organizatorice pentru protecția datelor:</p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Criptarea parolelor</li>
            <li>Acces restricționat la baza de date</li>
            <li>Jurnale de activitate (audit logs)</li>
            <li>Autentificare prin email și parole unice</li>
          </ul>
          <p className="text-gray-700 mt-4">
            Aplicația nu este în prezent optimizată pentru dispozitive mobile, dar poate fi accesată prin browser.
          </p>
        </section>
  
        {/* Secțiunea 9 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Consimțământ</h2>
          <p className="text-gray-700 mb-3">
            La crearea unui cont nou, utilizatorul va trebui să își exprime consimțământul explicit pentru:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Termenii și condițiile platformei</li>
            <li>Prezenta politică de confidențialitate</li>
          </ul>
          <p className="text-gray-700 mt-3">
            Aceasta va fi implementată printr-un checkbox obligatoriu în formularul de înregistrare.
          </p>
        </section>
  
        {/* Secțiunea 10 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Modificări ale politicii</h2>
          <p className="text-gray-700">
            Ne rezervăm dreptul de a actualiza această politică. Orice modificări semnificative vor fi comunicate prin e-mail sau printr-o notificare în aplicație.
          </p>
        </section>
  
        {/* Plan de Răspuns la Incidente */}
        <section className="mb-8 border-t pt-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            🚨 Plan de Răspuns la Incidente de Securitate - Next Corp
          </h2>
  
          {/* 1. Detectarea Incidentului */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">1. Detectarea Incidentului</h3>
            <p className="text-gray-700 mb-3"><strong>Surse de detectare:</strong></p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Rapoarte utilizatori</li>
              <li>Monitoring sistem automat</li>
              <li>Alerte furnizori (Render, AWS)</li>
              <li>Încercare de acces neautorizat</li>
            </ul>
          </div>
  
          {/* 2. Evaluarea Inițială */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">2. Evaluarea Inițială (în 1 oră)</h3>
            <p className="text-gray-700 mb-2"><strong>Persoane responsabile:</strong> Leonardo-Constantin Benciu (DPO)</p>
            <p className="text-gray-700 mb-3"><strong>Evaluare:</strong></p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Tipul incidentului (acces neautorizat, pierdere date, etc.)</li>
              <li>Numărul persoanelor afectate</li>
              <li>Tipul datelor compromise</li>
              <li><strong>Severitatea:</strong> <span className="inline-flex gap-2"><span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">SCĂZUTĂ</span> <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">MEDIE</span> <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">RIDICATĂ</span></span></li>
            </ul>
          </div>
  
          {/* 3. Conținerea Incidentului */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">3. Conținerea Incidentului (în 2 ore)</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Izolarea sistemului afectat</li>
              <li>Schimbarea parolelor administrative</li>
              <li>Oprirea temporară a serviciului dacă necesar</li>
              <li>Documentarea tuturor acțiunilor</li>
            </ul>
          </div>
  
          {/* 4. Investigația */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">4. Investigația (în 24 ore)</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Identificarea cauzei rădăcină</li>
              <li>Determinarea exactă a datelor compromise</li>
              <li>Evaluarea impactului asupra persoanelor vizate</li>
              <li>Documentarea completă a incidentului</li>
            </ul>
          </div>
  
          {/* 5. Notificarea GDPR */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">5. Notificarea GDPR (în 72 ore)</h3>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                <h4 className="font-semibold text-orange-800 mb-2">Pentru Autorități:</h4>
                <ul className="list-disc list-inside text-orange-700 text-sm space-y-1">
                  <li>Notificare la ANSPDCP (Autoritatea Națională) dacă risc pentru persoane</li>
                  <li><strong>Email:</strong> anspdcp@dataprotection.ro</li>
                  <li><strong>Include:</strong> natura incidentului, categoriile de date, numărul persoanelor, măsurile luate</li>
                </ul>
              </div>
              
              <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                <h4 className="font-semibold text-red-800 mb-2">Pentru Utilizatori (dacă risc ridicat):</h4>
                <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                  <li>Email la toți utilizatorii afectați</li>
                  <li>Explicarea clară a ce s-a întâmplat</li>
                  <li>Măsurile luate și recomandările pentru utilizatori</li>
                </ul>
              </div>
            </div>
          </div>
  
          {/* 6. Acțiuni Corective */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">6. Acțiuni Corective</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Remedierea vulnerabilității</li>
              <li>Îmbunătățirea măsurilor de securitate</li>
              <li>Actualizarea procedurilor</li>
              <li>Training suplimentar dacă necesar</li>
            </ul>
          </div>
  
          {/* 7. Monitorizare Post-Incident */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">7. Monitorizare Post-Incident</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Monitoring intensificat timp de 30 zile</li>
              <li>Raport final către management</li>
              <li>Lecții învățate și îmbunătățiri</li>
            </ul>
          </div>
  
          {/* Contacte de Urgență */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">Contacte de Urgență</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>DPO:</strong> Leonardo-Constantin Benciu</p>
                  <p><strong>Email:</strong> <a href="mailto:nextcorpromania@gmail.com" className="text-blue-600 hover:underline">nextcorpromania@gmail.com</a></p>
                  <p><strong>Autoritatea:</strong> <a href="mailto:anspdcp@dataprotection.ro" className="text-blue-600 hover:underline">anspdcp@dataprotection.ro</a></p>
                </div>
                <div>
                  <p><strong>Furnizori:</strong></p>
                  <p>Render Support, AWS Support</p>
                </div>
              </div>
            </div>
          </div>
  
          {/* Documentare */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">Documentare</h3>
            <p className="text-gray-700 mb-3">Toate incidentele se înregistrează în registrul de incidente cu:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Data și ora</li>
              <li>Descrierea incidentului</li>
              <li>Persoanele afectate</li>
              <li>Acțiunile luate</li>
              <li>Rezultatul final</li>
            </ul>
          </div>
        </section>
  
        {/* Contact Footer */}
        <div className="border-t pt-6 mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center gap-2">
              📬 Contact
            </h3>
            <p className="text-blue-800 text-sm">
              Pentru orice întrebări legate de protecția datelor, vă rugăm să ne contactați: <a href="mailto:nextcorpromania@gmail.com" className="underline">nextcorpromania@gmail.com</a>
            </p>
          </div>
          <div className="text-center text-sm text-gray-600">
            <p><strong>SC Next Corp SRL – Administrator și Responsabil cu Protecția Datelor</strong></p>
          </div>
        </div>
      </div>
    )
  }
  
  export default PrivacyPolicyPage