const complianceTranslations = {
  // Date-related errors
  "Transaction dates": "Datele tranzacțiilor",
  "are in the future": "sunt în viitor",
  "relative to current date": "față de data curentă",
  "Statement period start date": "Data de început a perioadei extrasului",
  "Statement period end date": "Data de sfârșit a perioadei extrasului",
  "is in the future": "este în viitor",
  "Transaction dates must not be in the future": "Datele tranzacțiilor nu trebuie să fie în viitor",
  "Statement period dates must not be in the future": "Datele perioadei extrasului nu trebuie să fie în viitor",
  "Invoice date must not be after": "Data facturii nu trebuie să fie după",
  "Document date cannot be in the future": "Data documentului nu poate fi în viitor",

  // Duplicate-related errors
  "Document is a duplicate of an existing document": "Documentul este duplicat al unui document existent",
  "with id": "cu id-ul",
  "Duplicate document detected": "Document duplicat detectat",
  "This document already exists in the system": "Acest document există deja în sistem",

  // Document type errors
  "The document is a Bank Statement, not an Invoice": "Documentul este un Extras de Cont, nu o Factură",
  "No invoice data extracted": "Nu s-au extras date de factură",
  "Document relevance for invoice processing is questionable": "Relevanța documentului pentru procesarea facturilor este discutabilă",
  "Document type mismatch": "Nepotrivire tip document",

  // IBAN and financial errors
  "Account number must follow Romanian IBAN format": "Numărul de cont trebuie să respecte formatul IBAN românesc",
  "RO + 22 characters": "RO + 22 caractere",
  "Invalid IBAN format": "Format IBAN invalid",
  "Account number format is incorrect": "Formatul numărului de cont este incorect",

  // VAT and tax errors
  "VAT number format is invalid": "Formatul numărului TVA este invalid",
  "VAT calculation is incorrect": "Calculul TVA este incorect",
  "Missing VAT number": "Lipsește numărul TVA",
  "Invalid VAT rate": "Cotă TVA invalidă",

  // Mathematical errors
  "Balances must be mathematically correct": "Soldurile trebuie să fie matematic corecte",
  "Transaction amounts do not balance": "Sumele tranzacțiilor nu se echilibrează",
  "Total amount calculation error": "Eroare în calculul sumei totale",

  // Missing field errors
  "Missing mandatory field": "Câmp obligatoriu lipsă",
  "Required field is empty": "Câmpul obligatoriu este gol",
  "Vendor information is missing": "Informațiile furnizorului lipsesc",
  "Buyer information is missing": "Informațiile cumpărătorului lipsesc",

  // ANAF compliance
  "Document does not meet ANAF standards": "Documentul nu respectă standardele ANAF",
  "ANAF compliance violation": "Încălcare conformitate ANAF",

  // Transaction specific
  "Transactions must have proper format and sequence": "Tranzacțiile trebuie să aibă format și secvență corecte",
  "Transaction description is unclear": "Descrierea tranzacției este neclară",

  // Common words and phrases
  "Error": "Eroare",
  "Warning": "Avertisment", 
  "Invalid": "Invalid",
  "Missing": "Lipsește",
  "Required": "Obligatoriu",
  "must be": "trebuie să fie",
  "cannot be": "nu poate fi",
  "is required": "este obligatoriu",
  "not found": "nu a fost găsit",
  "not valid": "nu este valid"
};

export const translateComplianceMessage = (message: string, language: string): string => {
  if (language !== 'ro') {
    return message;
  }

  let translatedMessage = message;

  const sortedTranslations = Object.entries(complianceTranslations)
    .sort(([a], [b]) => b.length - a.length);

  for (const [english, romanian] of sortedTranslations) {
    const regex = new RegExp(english.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    translatedMessage = translatedMessage.replace(regex, romanian);
  }

  return translatedMessage;
};

export const translateComplianceMessages = (messages: string[], language: string): string[] => {
  if (language !== 'ro') {
    return messages;
  }
  
  return messages.map(message => translateComplianceMessage(message, language));
};