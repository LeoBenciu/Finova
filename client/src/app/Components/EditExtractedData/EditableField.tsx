interface EditableFieldProps {
    label: string;
    fieldName: string;
    editFile: {
      result: Record<string, any>;
    } | undefined;
    setEditFile: (value: any) => void;
    maxWidth?: string;
  }
  
  const EditableField = ({ 
    label, 
    fieldName, 
    editFile, 
    setEditFile, 
    maxWidth = 'max-w-35' 
  }: EditableFieldProps) => {
    return (
      <>
        <div className="p-4 flex justify-center items-center text-[var(--text2)] font-bold">{label}</div>
        <div className="p-4 flex justify-center items-center">
          <input
            value={editFile?.result[fieldName] ?? '-'}
            className={`bg-[var(--foreground)] ${maxWidth} max-w-35 text-center py-2 rounded-2xl pl-1
            focus:ring-1 focus:ring-[var(--primary)] focus:outline-0
            text-[var(--text1)]`}
            onChange={(e) => {
              setEditFile({
                ...editFile,
                result: {
                  ...editFile?.result,
                  [fieldName]: e.target.value
                }
              });
            }}
          />
        </div>
      </>
    );
  };
  
  export default EditableField;
