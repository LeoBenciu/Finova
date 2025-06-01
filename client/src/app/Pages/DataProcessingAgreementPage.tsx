
const DataProcessingAgreementPage = () => {
    return (
        <div className="max-w-4xl mx-auto p-6 bg-white overflow-y-scroll max-h-screen">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Acord de Prelucrare a Datelor (DPA) - Next Corp
          </h1>
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>Versiunea:</strong> 1.0</p>
            <p><strong>Ultima actualizare:</strong> 30.05.2025</p>
          </div>
        </div>
  
        {/* Acceptarea Acordului */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Acceptarea Acordului</h2>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm mb-2">
              Prin crearea unui cont pe platforma Next Corp și bifarea checkbox-ului "Accept Acordul de Prelucrare a Datelor", 
              Utilizatorul (firma de contabilitate) acceptă în mod legal și obligatoriu termenii acestui DPA.
            </p>
            <p className="text-blue-800 text-sm">
              Acceptarea electronică are aceeași valabilitate juridică ca și semnarea fizică conform Regulamentului eIDAS și 
              Legii 455/2001 privind semnătura electronică.
            </p>
          </div>
        </section>
  
        {/* Părțile Contractante */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Părțile Contractante</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-800 mb-3">OPERATORUL (Data Controller)</h3>
              <p className="text-gray-700 text-sm">
                Firma de contabilitate care își creează cont pe platforma Next Corp și acceptă acest DPA prin bifarea checkbox-ului în procesul de înregistrare.
              </p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-800 mb-3">ÎMPUTERNICITUL (Data Processor)</h3>
              <div className="text-gray-700 text-sm space-y-1">
                <p><strong>SC Next Corp SRL</strong></p>
                <p>Strada Principală nr. 223, sat Pâncești, comuna Pâncești, jud. Bacău, România</p>
                <p><strong>CUI:</strong> 47935139</p>
                <p><strong>Nr. Înregistrare:</strong> J04/577/2023</p>
                <p><strong>Telefon:</strong> +40725176707</p>
                <p><strong>Reprezentat legal de:</strong> Benciu Leonardo-Constantin, Administrator</p>
              </div>
            </div>
          </div>
        </section>
  
        {/* Secțiunea 1 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Obiectul și Scopul Acordului</h2>
          <p className="text-gray-700 mb-3">
            Acest Acord de Prelucrare a Datelor (DPA) reglementează condițiile în care Next Corp prelucrează datele cu caracter personal 
            în numele și pentru contul Operatorului, în conformitate cu:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Regulamentul General privind Protecția Datelor (GDPR) - Regulamentul UE 2016/679</li>
            <li>Legea nr. 190/2018 privind măsuri de punere în aplicare a GDPR în România</li>
          </ul>
        </section>
  
        {/* Secțiunea 2 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Datele Prelucrate și Categoriile de Persoane Vizate</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">2.1 Categoriile de Date cu Caracter Personal</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li><strong>Date de identificare:</strong> nume, prenume, CNP (când apare în documente)</li>
              <li><strong>Date financiare:</strong> facturi, extrase bancare, tranzacții</li>
              <li><strong>Date de contact:</strong> adrese email, numere de telefon (din documente)</li>
              <li><strong>Date juridice:</strong> informații din contracte, acorduri comerciale</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">2.2 Categoriile de Persoane Vizate</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Angajații clienților firmei de contabilitate</li>
              <li>Partenerii comerciali ai clienților</li>
              <li>Persoanele fizice autorizate (PFA) care sunt clienți</li>
              <li>Reprezentanții legali ai persoanelor juridice</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">2.3 Natura și Scopul Prelucrării</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Digitalizarea și structurarea documentelor contabile</li>
              <li>Extragerea automată de date din facturi și documente</li>
              <li>Stocarea temporară pentru procesare</li>
              <li>Integrarea cu software-ul contabil al Operatorului</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 3 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Obligațiile Împuternicitului (Next Corp)</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">3.1 Instrucțiuni de Prelucrare</h3>
            <p className="text-gray-700 mb-3">Next Corp se obligă să prelucreze datele cu caracter personal exclusiv:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Conform instrucțiunilor documentate ale Operatorului</li>
              <li>În scopurile specificate în acest DPA</li>
              <li>În conformitate cu legislația aplicabilă privind protecția datelor</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">3.2 Confidențialitatea</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Toate persoanele autorizate să prelucreze datele au încheiat acorduri de confidențialitate</li>
              <li>Accesul la date este restricționat doar la personalul strict necesar</li>
              <li>Se interzice utilizarea datelor în scopuri proprii sau ale unor terți</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">3.3 Măsuri de Securitate (Art. 32 GDPR)</h3>
            <p className="text-gray-700 mb-3">Next Corp implementează următoarele măsuri tehnice și organizatorice:</p>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Măsuri Tehnice:</h4>
                <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                  <li>Criptarea datelor în tranzit (HTTPS/TLS)</li>
                  <li>Criptarea datelor în repaus (baza de date criptată)</li>
                  <li>Controlul accesului prin autentificare securizată</li>
                  <li>Jurnalizarea și monitorizarea accesului la date</li>
                  <li>Backup-uri regulate și securizate</li>
                </ul>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Măsuri Organizatorice:</h4>
                <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                  <li>Proceduri de gestionare a accesului utilizatorilor</li>
                  <li>Training regulat al personalului privind protecția datelor</li>
                  <li>Politici interne de securitate și confidențialitate</li>
                  <li>Proceduri de răspuns la incidente</li>
                </ul>
              </div>
            </div>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">3.4 Sub-împuterniciri</h3>
            <p className="text-gray-700 mb-3">Next Corp poate apela la următorii sub-împuterniciți:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li><strong>Render.com</strong> - găzduire baze de date (Spațiul Economic European)</li>
              <li><strong>Amazon Web Services (AWS)</strong> - stocare documente (cu SCC pentru transferuri)</li>
              <li><strong>Google LLC</strong> - servicii email pentru resetare parole (cu SCC pentru transferuri)</li>
            </ul>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
              <p className="text-yellow-800 text-sm">
                Operatorul își exprimă acordul pentru acești sub-împuterniciți. Next Corp va informa Operatorul despre orice modificări cu 30 de zile înainte.
              </p>
            </div>
          </div>
        </section>
  
        {/* Secțiunea 4 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Obligațiile Operatorului</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">4.1 Instrucțiuni Legale</h3>
            <p className="text-gray-700 mb-3">Operatorul garantează că:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Are baza legală pentru prelucrarea datelor transmise</li>
              <li>A informat persoanele vizate despre prelucrare conform Art. 13-14 GDPR</li>
              <li>Instrucțiunile date respectă legislația aplicabilă</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">4.2 Calitatea Datelor</h3>
            <p className="text-gray-700 mb-3">Operatorul este responsabil pentru:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Exactitatea și actualitatea datelor transmise</li>
              <li>Respectarea principiului minimizării datelor</li>
              <li>Clasificarea corectă a tipurilor de date transmise</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 5 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Drepturile Persoanelor Vizate</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">5.1 Solicitări de la Persoane Vizate</h3>
            <p className="text-gray-700 mb-3">Când Next Corp primește solicitări directe de la persoane vizate:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Va redirecționa solicitarea către Operator în 5 zile lucrătoare</li>
              <li>Va asista Operatorul în răspunsul la solicitări în 10 zile lucrătoare</li>
              <li>Nu va răspunde direct persoanelor vizate fără acordul Operatorului</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">5.2 Tipuri de Solicitări Suportate</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Dreptul de acces (Art. 15 GDPR)</li>
              <li>Dreptul la rectificare (Art. 16 GDPR)</li>
              <li>Dreptul la ștergere (Art. 17 GDPR)</li>
              <li>Dreptul la restricționarea prelucrării (Art. 18 GDPR)</li>
              <li>Dreptul la portabilitatea datelor (Art. 20 GDPR)</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 6 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Încălcări ale Securității Datelor</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">6.1 Notificarea Încălcărilor</h3>
            <p className="text-gray-700 mb-3">Next Corp se obligă să:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Notifice Operatorul despre orice încălcare în maximum 24 ore de la descoperire</li>
              <li>Furnizeze toate informațiile disponibile despre incident</li>
              <li>Asiste în evaluarea riscului și măsurilor de remediere</li>
              <li>Implementeze măsuri corective pentru prevenirea repetării</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">6.2 Informații Obligatorii în Notificare</h3>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Natura încălcării și categoriile de date afectate</li>
              <li>Numărul aproximativ de persoane vizate</li>
              <li>Consecințele probabile ale încălcării</li>
              <li>Măsurile luate sau propuse pentru remediere</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 7 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Transferuri Internaționale</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">7.1 Transferuri în Afara SEE</h3>
            <p className="text-gray-700 mb-3">Pentru transferurile către AWS (SUA) și Google (SUA):</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Se aplică Clauzele Contractuale Standard (SCC) aprobate de Comisia Europeană</li>
              <li>Se efectuează evaluări de impact pentru fiecare transfer</li>
              <li>Se monitorizează continuu legalitatea transferurilor</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">7.2 Garanții Suplimentare</h3>
            <p className="text-gray-700 mb-3">Next Corp garantează că:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Toate transferurile sunt necesare pentru furnizarea serviciului</li>
              <li>Destinatarii oferă garanții adecvate de protecție</li>
              <li>Există măcanisme de remediere pentru persoanele vizate</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 8 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Durata și Returnarea/Ștergerea Datelor</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">8.1 Durata Prelucrării</h3>
            <p className="text-gray-700 mb-3">Datele sunt prelucrate pe durata contractului și pot fi păstrate:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Maximum 30 zile după încetarea contractului pentru finalizarea proceselor</li>
              <li>Conform obligațiilor legale de arhivare (dacă aplicabil)</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">8.2 Returnarea sau Ștergerea</h3>
            <p className="text-gray-700 mb-3">La sfârșitul contractului sau la solicitarea Operatorului:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Next Corp va returna toate datele într-un format structurat</li>
              <li>Va șterge definitiv și imediat toate copiile din sistemele proprii</li>
              <li>Va confirma în scris ștergerea completă în maximum 7 zile</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 9 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">9. Audituri și Inspecții</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">9.1 Dreptul de Audit</h3>
            <p className="text-gray-700 mb-3">Operatorul are dreptul să:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Solicite rapoarte despre măsurile de securitate implementate</li>
              <li>Efectueze audituri la sediul Next Corp cu preaviz de 30 zile</li>
              <li>Verifice conformitatea cu acest DPA anual sau la solicitare</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">9.2 Cooperarea în Audituri</h3>
            <p className="text-gray-700 mb-3">Next Corp se obligă să:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Furnizeze acces la documentația relevantă</li>
              <li>Permită interviuri cu personalul responsabil</li>
              <li>Implementeze recomandările rezonabile rezultate din audit</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 10 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">10. Răspunderea și Limitările</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">10.1 Răspunderea Next Corp</h3>
            <p className="text-gray-700 mb-3">Next Corp răspunde pentru:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Daunele cauzate de încălcarea obligațiilor din acest DPA</li>
              <li>Costurile asociate cu notificările către autorități sau persoane vizate</li>
              <li>Măsurile corective necesare în urma unui incident</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">10.2 Limitări de Răspundere</h3>
            <p className="text-gray-700 mb-3">Răspunderea este limitată la:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Daunele directe și previzibile</li>
              <li>Maximum valoarea contractului pe ultimele 12 luni</li>
              <li>Exclude daunele indirecte sau pierderea de profit</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 11 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">11. Încetarea Acordului</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">11.1 Motive de Încetare</h3>
            <p className="text-gray-700 mb-3">Acordul încetează prin:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Expirarea sau rezilierea contractului principal</li>
              <li>Acordul mutual al părților</li>
              <li>Încălcări grave neremediabile ale obligațiilor</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">11.2 Efectele Încetării</h3>
            <p className="text-gray-700 mb-3">La încetare:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Obligațiile de confidențialitate rămân în vigoare</li>
              <li>Se aplică procedurile de returnare/ștergere a datelor</li>
              <li>Se finalizează toate procesele în curs</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 12 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">12. Acceptarea Electronică și Intrarea în Vigoare</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">12.1 Modalitatea de Acceptare</h3>
            <p className="text-gray-700 mb-3">Acest DPA intră în vigoare prin:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Bifarea checkbox-ului "Accept Acordul de Prelucrare a Datelor" în procesul de înregistrare</li>
              <li>Finalizarea creării contului pe platforma Next Corp</li>
              <li>Încărcarea primului document care conține date cu caracter personal ale clienților</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">12.2 Evidența Acceptării</h3>
            <p className="text-gray-700 mb-3">Next Corp păstrează în mod automat:</p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Data și ora acceptării DPA-ului</li>
              <li>Adresa IP de la care s-a făcut acceptarea</li>
              <li>Identificatorul utilizatorului care a acceptat</li>
              <li>Versiunea DPA-ului acceptată</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">12.3 Valabilitatea Juridică</h3>
            <p className="text-gray-700 mb-3">
              Acceptarea electronică prin checkbox are aceeași forță juridică ca și semnarea fizică, conform:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
              <li>Regulamentului eIDAS (UE) Nr. 910/2014</li>
              <li>Legii nr. 455/2001 privind semnătura electronică</li>
              <li>Art. 6 și 7 din GDPR privind valabilitatea consimțământului electronic</li>
            </ul>
          </div>
        </section>
  
        {/* Secțiunea 13 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">13. Dispoziții Finale</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">13.1 Modificări</h3>
            <p className="text-gray-700">
              Modificările acestui DPA se comunică prin email și prin notificare în aplicație cu 30 zile înainte de intrarea în vigoare. 
              Continuarea utilizării serviciului după această perioadă constituie acceptarea modificărilor.
            </p>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">13.2 Legea Aplicabilă</h3>
            <p className="text-gray-700">
              Acest DPA este guvernat de legea română și jurisdicția instanțelor române.
            </p>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3">13.3 Ierarhia Documentelor</h3>
            <p className="text-gray-700">
              În caz de conflict: GDPR &gt; acest DPA &gt; Termenii și Condițiile de Utilizare &gt; alte documente.
            </p>
          </div>
        </section>
  
        {/* Footer */}
        <div className="border-t pt-6 mt-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm text-center">
              Prin bifarea checkbox-ului și crearea contului, confirmați că aveți autoritatea legală de a accepta acest DPA în numele 
              organizației dumneavoastră și că înțelegeți toate obligațiile ce decurg din acest acord.
            </p>
          </div>
          <div className="text-center text-sm text-gray-600">
            <p><strong>SC Next Corp SRL</strong></p>
            <p>Data ultimei actualizări: 30.05.2025</p>
          </div>
        </div>
      </div>
  
    )
  }
  
  export default DataProcessingAgreementPage