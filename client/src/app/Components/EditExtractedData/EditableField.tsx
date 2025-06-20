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
  setEditFile
}: EditableFieldProps) => {
  return (
    <>
      <div className="p-4 flex justify-center items-center text-[var(--text1)] font-semibold">{label}</div>
      <div className="p-4 flex justify-center items-center">
        <input
          value={editFile?.result[fieldName] ?? ''}
          className="bg-[var(--background)] min-h-11 rounded-2xl px-4 py-2 text-center
          border-[1px] border-[var(--text4)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent
          text-[var(--text1)] transition-all duration-200 placeholder-[var(--text3)] w-full max-w-80"
          onChange={(e) => {
            setEditFile({
              ...editFile,
              result: {
                ...editFile?.result,
                [fieldName]: e.target.value
              }
            });
          }}
          placeholder={`Enter ${label.toLowerCase()}...`}
        />
      </div>
    </>
  );
};

export default EditableField;