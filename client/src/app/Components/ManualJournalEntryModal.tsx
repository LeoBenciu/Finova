"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Trash2 } from "lucide-react";
import { useCreateManualJournalEntryMutation } from "@/redux/slices/apiSlice";

interface JournalEntry {
  accountCode: string;
  debit?: number;
  credit?: number;
  description?: string;
}

interface ManualJournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientEin: string;
  onSuccess?: () => void;
}

export default function ManualJournalEntryModal({ 
  isOpen, 
  onClose, 
  clientEin, 
  onSuccess 
}: ManualJournalEntryModalProps) {
  const [postingDate, setPostingDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [entries, setEntries] = useState<JournalEntry[]>([
    { accountCode: '', debit: 0, description: '' },
    { accountCode: '', credit: 0, description: '' }
  ]);
  
  const [createEntry, { isLoading }] = useCreateManualJournalEntryMutation();

  const addEntry = () => {
    setEntries([...entries, { accountCode: '', debit: 0, description: '' }]);
  };

  const removeEntry = (index: number) => {
    if (entries.length > 2) {
      setEntries(entries.filter((_, i) => i !== index));
    }
  };

  const updateEntry = (index: number, field: keyof JournalEntry, value: any) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    
    // If setting debit, clear credit and vice versa
    if (field === 'debit' && value > 0) {
      newEntries[index].credit = undefined;
    } else if (field === 'credit' && value > 0) {
      newEntries[index].debit = undefined;
    }
    
    setEntries(newEntries);
  };

  const calculateTotals = () => {
    const totalDebit = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0);
    const totalCredit = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0);
    return { totalDebit, totalCredit, isBalanced: Math.abs(totalDebit - totalCredit) < 0.01 };
  };

  const handleSubmit = async () => {
    const { isBalanced } = calculateTotals();
    
    if (!isBalanced) {
      alert('Entries must be balanced (total debits = total credits)');
      return;
    }

    // Validate all entries have account codes
    const hasEmptyAccountCodes = entries.some(entry => !entry.accountCode.trim());
    if (hasEmptyAccountCodes) {
      alert('All entries must have account codes');
      return;
    }

    // Validate all entries have amounts
    const hasNoAmounts = entries.some(entry => !entry.debit && !entry.credit);
    if (hasNoAmounts) {
      alert('All entries must have either debit or credit amounts');
      return;
    }

    try {
      await createEntry({
        ein: clientEin,
        body: {
          postingDate,
          entries: entries.map(entry => ({
            accountCode: entry.accountCode.trim(),
            debit: entry.debit || undefined,
            credit: entry.credit || undefined,
            description: entry.description?.trim() || undefined
          })),
          reference: reference.trim() || undefined
        }
      }).unwrap();

      alert('Manual journal entry created successfully!');
      onSuccess?.();
      onClose();
      
      // Reset form
      setEntries([
        { accountCode: '', debit: 0, description: '' },
        { accountCode: '', credit: 0, description: '' }
      ]);
      setReference('');
      setPostingDate(new Date().toISOString().split('T')[0]);
    } catch (error: any) {
      console.error('Error creating manual journal entry:', error);
      alert(error?.data?.message || 'Failed to create manual journal entry');
    }
  };

  const { totalDebit, totalCredit, isBalanced } = calculateTotals();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Create Manual Journal Entry</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Header Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="postingDate">Posting Date</Label>
              <Input
                id="postingDate"
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reference">Reference</Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional reference"
              />
            </div>
          </div>

          {/* Journal Entries */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <Label className="text-lg font-semibold">Journal Entries</Label>
              <Button onClick={addEntry} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            </div>

            <div className="space-y-3">
              {entries.map((entry, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <Label>Account Code</Label>
                    <Input
                      value={entry.accountCode}
                      onChange={(e) => updateEntry(index, 'accountCode', e.target.value)}
                      placeholder="e.g., 401, 5121"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label>Debit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={entry.debit || ''}
                      onChange={(e) => updateEntry(index, 'debit', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label>Credit</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={entry.credit || ''}
                      onChange={(e) => updateEntry(index, 'credit', parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                    />
                  </div>
                  
                  <div className="col-span-4">
                    <Label>Description</Label>
                    <Input
                      value={entry.description || ''}
                      onChange={(e) => updateEntry(index, 'description', e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>
                  
                  <div className="col-span-1">
                    {entries.length > 2 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeEntry(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Total Debit</Label>
                <div className={`text-lg font-semibold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {totalDebit.toFixed(2)} RON
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Total Credit</Label>
                <div className={`text-lg font-semibold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {totalCredit.toFixed(2)} RON
                </div>
              </div>
            </div>
            
            {!isBalanced && (
              <div className="text-red-600 text-sm mt-2">
                ⚠️ Entries must be balanced (total debits = total credits)
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!isBalanced || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Creating...' : 'Create Entry'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
