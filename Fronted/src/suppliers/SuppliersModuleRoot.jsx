import React, { useState } from 'react';
import { SuppliersListView } from './SuppliersListView';
import { SupplierEditor } from './SupplierEditor';
import { SupplierDetailDrawer } from './SupplierDetailDrawer';

export function SuppliersModuleRoot() {
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [editingSupplierId, setEditingSupplierId] = useState(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  const handleCreateSupplier = () => {
    setEditingSupplierId(null);
    setIsEditorOpen(true);
  };

  const handleEditSupplier = (id) => {
    setEditingSupplierId(id);
    setIsEditorOpen(true);
  };

  const handleSaved = () => {
    setIsEditorOpen(false);
    setRefreshToken((prev) => prev + 1);
  };

  const handleRefresh = () => {
    setRefreshToken((prev) => prev + 1);
  };

  return (
    <div className="suppliers-module-root" key={refreshToken}>
      <SuppliersListView
        onSelectSupplier={setSelectedSupplierId}
        onCreateSupplier={handleCreateSupplier}
      />

      <SupplierEditor
        open={isEditorOpen}
        supplierId={editingSupplierId}
        onSaved={handleSaved}
        onClose={() => setIsEditorOpen(false)}
      />

      <SupplierDetailDrawer
        supplierId={selectedSupplierId}
        onClose={() => setSelectedSupplierId(null)}
        onEdit={handleEditSupplier}
        onRefresh={handleRefresh}
      />
    </div>
  );
}
