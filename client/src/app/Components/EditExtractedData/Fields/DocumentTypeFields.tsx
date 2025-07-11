import React from 'react';
import EditableField from '../EditableField';
import { useSelector } from 'react-redux';

interface DefaultFieldsProps {
  editFile: any;
  setEditFile: (value: any) => void;
}

const DefaultFields: React.FC<DefaultFieldsProps> = ({ editFile, setEditFile }) => {
  const language = useSelector((state: { user: { language: string } }) => state.user.language);

  // Get all fields from the result object except document_type
  const fields = Object.keys(editFile?.result || {}).filter(key => key !== 'document_type' && key !== 'line_items');

  return (
    <div className="space-y-4">
      <p className="text-[var(--text2)] text-sm mb-4">
        {language === 'ro' 
          ? 'Tip document necunoscut. Afișăm toate câmpurile disponibile.'
          : 'Unknown document type. Displaying all available fields.'}
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {fields.map((fieldName) => (
          <EditableField
            key={fieldName}
            label={fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ')}
            fieldName={fieldName}
            editFile={editFile}
            setEditFile={setEditFile}
          />
        ))}
      </div>
    </div>
  );
};

export default DefaultFields;