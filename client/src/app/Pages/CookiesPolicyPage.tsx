
const CookiesPolicyPage = () => {
    return (
        <div className="max-w-4xl mx-auto p-6 bg-white overflow-y-scroll max-h-screen">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
            🍪 Politica de Cookie-uri – Next Corp
          </h1>
          <p className="text-sm text-gray-600">
            <strong>Ultima actualizare:</strong> 30.05.2025
          </p>
        </div>
  
        {/* Secțiunea 1 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">1. Ce sunt cookie-urile?</h2>
          <p className="text-gray-700 leading-relaxed">
            Cookie-urile sunt fișiere text mici care se stochează pe dispozitivul dumneavoastră atunci când vizitați aplicația noastră. 
            Acestea ne ajută să vă oferim o experiență mai bună și să menținem funcționalitatea aplicației.
          </p>
        </section>
  
        {/* Secțiunea 2 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">2. Ce tipuri de cookie-uri folosim?</h2>
          
          {/* Cookie-uri Esențiale */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3 flex items-center gap-2">
              🔧 Cookie-uri Esențiale (Strict Necesare)
            </h3>
            <p className="text-gray-700 mb-4">
              Aceste cookie-uri sunt absolut necesare pentru funcționarea aplicației și nu pot fi dezactivate.
            </p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Cookie</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Scop</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Durata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-red-700">session_id</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Menținerea sesiunii utilizatorului autentificat</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Sesiune</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-red-700">csrf_token</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Protecție împotriva atacurilor CSRF</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Sesiune</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-red-700">app_auth</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Stocarea stării de autentificare</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">30 zile</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
  
          {/* Cookie-uri de Performanță */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3 flex items-center gap-2">
              📊 Cookie-uri de Performanță (Opționale)
            </h3>
            <p className="text-gray-700 mb-4">
              Ne ajută să înțelegem cum utilizați aplicația pentru a o îmbunătăți.
            </p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Cookie</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Scop</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Durata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-red-700">analytics_session</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Măsurarea utilizării aplicației</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">24 ore</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-red-700">error_tracking</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Detectarea și raportarea erorilor</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">7 zile</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
  
          {/* Cookie-uri de Funcționalitate */}
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3 flex items-center gap-2">
              ⚙️ Cookie-uri de Funcționalitate (Opționale)
            </h3>
            <p className="text-gray-700 mb-4">
              Îmbunătățesc experiența dumneavoastră prin reținerea preferințelor.
            </p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-300 rounded-lg">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Cookie</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Scop</th>
                    <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-black">Durata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-red-700">user_preferences</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Stocarea setărilor personalizate</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">1 an</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-red-700">language_pref</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Reținerea limbii selectate</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">1 an</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 font-mono text-sm text-red-700">theme_mode</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">Reținerea temei (dark/light mode)</td>
                    <td className="border border-gray-300 px-4 py-2 text-black">1 an</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
  
        {/* Secțiunea 3 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">3. Cookie-uri de la terțe părți</h2>
          <p className="text-gray-700 mb-4">
            Aplicația noastră poate utiliza servicii externe care setează propriile cookie-uri:
          </p>
          
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-800 mb-2 flex items-center gap-2">
              🔐 Servicii de Securitate
            </h3>
            <ul className="list-disc list-inside text-gray-700 ml-4">
              <li><strong>Render.com</strong> (găzduire) - cookie-uri tehnice pentru securitate</li>
              <li><strong>AWS CloudFront</strong> - optimizarea livrării conținutului</li>
            </ul>
          </div>
  
          <div className="mb-4">
            <h3 className="text-lg font-medium text-gray-800 mb-2 flex items-center gap-2">
              📧 Servicii de Comunicare
            </h3>
            <ul className="list-disc list-inside text-gray-700 ml-4">
              <li><strong>Gmail API</strong> - pentru funcționalitatea de resetare parolă</li>
            </ul>
          </div>
  
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Notă:</strong> Nu folosim Google Analytics, Facebook Pixel sau alte sisteme de tracking publicitar.
            </p>
          </div>
        </section>
  
        {/* Secțiunea 4 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">4. Gestionarea cookie-urilor</h2>
          
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3 flex items-center gap-2">
              ✅ Acceptarea cookie-urilor
            </h3>
            <p className="text-gray-700 mb-3">
              La prima vizită, veți vedea un banner pentru acceptarea cookie-urilor:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4">
              <li><strong>Acceptă toate</strong> - permite toate tipurile de cookie-uri</li>
              <li><strong>Doar esențiale</strong> - permite doar cookie-urile necesare funcționării</li>
              <li><strong>Personalizează</strong> - alegeți ce tipuri doriți să acceptați</li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3 flex items-center gap-2">
              ⚙️ Modificarea preferințelor
            </h3>
            <p className="text-gray-700 mb-3">
              Puteți modifica oricând setările cookie-urilor prin:
            </p>
            <ul className="list-disc list-inside text-gray-700 ml-4">
              <li>Meniul <strong>Setări</strong> → <strong>Confidențialitate</strong> → <strong>Cookie-uri</strong></li>
              <li>Link-ul din footer: <strong>Setări Cookie-uri</strong></li>
            </ul>
          </div>
  
          <div className="mb-6">
            <h3 className="text-xl font-medium text-gray-800 mb-3 flex items-center gap-2">
              🗑️ Ștergerea cookie-urilor
            </h3>
            <p className="text-gray-700 mb-3">
              Pentru a șterge cookie-urile existente:
            </p>
            <ol className="list-decimal list-inside text-gray-700 ml-4 space-y-1">
              <li><strong>Chrome:</strong> Setări → Confidențialitate → Șterge datele de navigare</li>
              <li><strong>Firefox:</strong> Setări → Confidențialitate → Șterge istoricul</li>
              <li><strong>Safari:</strong> Preferințe → Confidențialitate → Gestionează datele site-urilor web</li>
            </ol>
          </div>
        </section>
  
        {/* Secțiunea 5 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">5. Cookie-uri esențiale pentru funcționare</h2>
          <p className="text-gray-700 mb-4">
            Următoarele funcționalități necesită cookie-uri obligatorii:
          </p>
          <ul className="list-none text-gray-700 ml-4 space-y-2">
            <li className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              Autentificarea în cont
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              Menținerea sesiunii de lucru
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              Protecția împotriva atacurilor de securitate
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-600">✅</span>
              Salvarea documentelor încărcate în sesiune
            </li>
          </ul>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
            <p className="text-yellow-800 text-sm">
              <strong>Important:</strong> Dezactivarea cookie-urilor esențiale poate face aplicația să nu funcționeze corect.
            </p>
          </div>
        </section>
  
        {/* Secțiunea 6 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">6. Drepturile dumneavoastră</h2>
          <p className="text-gray-700 mb-4">
            Conform GDPR, aveți următoarele drepturi:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-2">
            <li><strong>Dreptul la informare</strong> - să știți ce cookie-uri folosim</li>
            <li><strong>Dreptul de acces</strong> - să vedeți ce date stocăm</li>
            <li><strong>Dreptul la ștergere</strong> - să solicitați eliminarea cookie-urilor</li>
            <li><strong>Dreptul de opoziție</strong> - să refuzați cookie-urile opționale</li>
          </ul>
        </section>
  
        {/* Secțiunea 7 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">7. Contact</h2>
          <p className="text-gray-700 mb-4">
            Pentru întrebări despre cookie-uri sau pentru exercitarea drepturilor:
          </p>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <p className="flex items-center gap-2">
              <span>📧</span>
              <strong className="text-black">Email:</strong> 
              <a href="mailto:nextcorpromania@gmail.com" className="text-blue-600 hover:underline">
                nextcorpromania@gmail.com
              </a>
            </p>
            <p className="flex items-start gap-2">
              <span>🏢</span>
              <span className="text-black">
                <strong>SC Next Corp SRL</strong><br />
                Strada Principală nr. 223, sat Pâncești,<br />
                comuna Pâncești, jud. Bacău, România
              </span>
            </p>
            <p className="flex items-center gap-2">
              <span className="text-black">👤</span>
              <strong>DPO:</strong> Benciu Leonardo-Constantin
            </p>
          </div>
        </section>
  
        {/* Secțiunea 8 */}
        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">8. Modificări ale politicii</h2>
          <p className="text-gray-700 mb-4">
            Această politică poate fi actualizată periodic. Modificările vor fi comunicate prin:
          </p>
          <ul className="list-disc list-inside text-gray-700 ml-4 space-y-1">
            <li>Notificare în aplicație</li>
            <li>Email către utilizatorii înregistrați</li>
            <li>Actualizarea datei în partea de sus a documentului</li>
          </ul>
        </section>
  
        {/* Footer */}
        <div className="border-t pt-6 mt-8">
          <p className="text-sm text-gray-600 italic text-center">
            Prin continuarea utilizării aplicației Next Corp, confirmați că ați citit și acceptat această politică de cookie-uri.
          </p>
        </div>
      </div>
    )
  }
  
  export default CookiesPolicyPage