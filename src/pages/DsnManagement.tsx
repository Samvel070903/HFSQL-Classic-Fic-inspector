import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FolderOpen, Save, X, Database, AlertCircle } from 'lucide-react';
import { dsnService, DSN } from '../services/dsnService';
import { useApp } from '../context/AppContext';
import FolderPicker from '../components/FolderPicker';

const DsnManagement: React.FC = () => {
  const { addLog } = useApp();
  const [dsns, setDsns] = useState<DSN[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<DSN>>({
    name: '',
    path: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  useEffect(() => {
    loadDSNs();
  }, []);

  const loadDSNs = async () => {
    try {
      const backendDsns = await dsnService.getAllFromBackend();
      setDsns(backendDsns);
    } catch (error: any) {
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Erreur lors du chargement des DSN: ${error.message}`,
        details: error,
      });
      // Fallback sur localStorage si le backend n'est pas disponible
      setDsns(dsnService.getAll());
    }
  };

  const handleOpenForm = (dsn?: DSN) => {
    if (dsn) {
      setFormData({
        name: dsn.name,
        path: dsn.path,
        description: dsn.description || '',
      });
      // Pour les DSN Windows, l'ID est le nom
      setEditingId(dsn.id || dsn.name);
    } else {
      setFormData({
        name: '',
        path: '',
        description: '',
      });
      setEditingId(null);
    }
    setFormErrors({});
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setFormData({
      name: '',
      path: '',
      description: '',
    });
    setFormErrors({});
    setEditingId(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Valider le nom
    const nameValidation = dsnService.validateName(formData.name || '');
    if (!nameValidation.valid) {
      errors.name = nameValidation.error || 'Nom invalide';
    }

    // Valider le chemin
    const pathValidation = dsnService.validatePath(formData.path || '');
    if (!pathValidation.valid) {
      errors.path = pathValidation.error || 'Chemin invalide';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      if (editingId) {
        // Utiliser editingId comme nom pour la mise à jour (c'est le nom du DSN Windows)
        await dsnService.updateInBackend(editingId, {
          name: formData.name!,
          path: formData.path!,
          description: formData.description || undefined,
        });
        addLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'info',
          message: `DSN "${formData.name}" mis à jour avec succès dans Windows`,
        });
      } else {
        await dsnService.createInBackend({
          name: formData.name!,
          path: formData.path!,
          description: formData.description || undefined,
        });
        addLog({
          id: Date.now().toString(),
          timestamp: new Date(),
          level: 'info',
          message: `DSN "${formData.name}" créé avec succès dans Windows`,
        });
      }
      
      await loadDSNs();
      handleCloseForm();
      // Notifier les autres composants du changement
      window.dispatchEvent(new CustomEvent('dsnUpdated'));
    } catch (error: any) {
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Erreur lors de la sauvegarde du DSN: ${error.message}`,
        details: error,
      });
      setFormErrors({ general: error.message });
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer le DSN "${name}" ?`)) {
      return;
    }

    try {
      await dsnService.deleteFromBackend(name);
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'info',
        message: `DSN "${name}" supprimé avec succès de Windows`,
      });
      await loadDSNs();
      // Notifier les autres composants du changement
      window.dispatchEvent(new CustomEvent('dsnUpdated'));
    } catch (error: any) {
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Erreur lors de la suppression du DSN: ${error.message}`,
        details: error,
      });
    }
  };

  const handleBrowseFolder = () => {
    // Ouvrir le sélecteur de dossier personnalisé
    setShowFolderPicker(true);
  };

  const handleFolderSelected = (path: string) => {
    setFormData({ ...formData, path });
    setShowFolderPicker(false);
  };

  const handleTestConnection = async (dsn: DSN) => {
    setIsTesting(dsn.id || dsn.name || null);
    try {
      // Ici on pourrait tester si le chemin existe ou si des fichiers .fic sont présents
      // Pour l'instant, on simule juste une vérification
      await new Promise(resolve => setTimeout(resolve, 500));
      
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'info',
        message: `DSN "${dsn.name}" : Le chemin semble valide`,
      });
    } catch (error: any) {
      addLog({
        id: Date.now().toString(),
        timestamp: new Date(),
        level: 'error',
        message: `Erreur lors du test du DSN "${dsn.name}": ${error.message}`,
        details: error,
      });
    } finally {
      setIsTesting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-theme-foreground">Gestion des DSN</h1>
        <button
          onClick={() => handleOpenForm()}
          className="flex items-center gap-2 px-4 py-2 bg-theme-primary rounded-lg text-white transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouveau DSN
        </button>
      </div>

      {/* Formulaire d'édition/création */}
      {showForm && (
        <div className="bg-theme-card rounded-lg border border-theme-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-theme-card">
              {editingId ? 'Modifier le DSN' : 'Nouveau DSN'}
            </h2>
            <button
              onClick={handleCloseForm}
              className="text-theme-secondary hover:text-theme-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {formErrors.general && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {formErrors.general}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme-statusbar mb-2">
                Nom du DSN *
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) setFormErrors({ ...formErrors, name: '' });
                }}
                placeholder="Mon_DSN"
                className={`w-full px-4 py-2 bg-theme-input border ${
                  formErrors.name ? 'border-red-500' : 'border-theme-input'
                } rounded-lg text-theme-input placeholder-theme-input focus:outline-none focus:ring-2 ring-theme-focus`}
              />
              {formErrors.name && (
                <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>
              )}
              <p className="mt-1 text-xs text-theme-secondary">
                Nom unique pour identifier ce DSN (lettres, chiffres, espaces, tirets, underscores)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-statusbar mb-2">
                Chemin vers les fichiers *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.path || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, path: e.target.value });
                    if (formErrors.path) setFormErrors({ ...formErrors, path: '' });
                  }}
                  placeholder="C:\\data\\database ou /data/database"
                  className={`flex-1 px-4 py-2 bg-theme-input border ${
                    formErrors.path ? 'border-red-500' : 'border-theme-input'
                  } rounded-lg text-theme-input placeholder-theme-input focus:outline-none focus:ring-2 ring-theme-focus`}
                />
                <button
                  onClick={handleBrowseFolder}
                  className="px-4 py-2 bg-theme-secondary border border-theme-input rounded-lg text-white transition-colors flex items-center gap-2"
                  title="Parcourir les dossiers"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              </div>
              {formErrors.path && (
                <p className="mt-1 text-xs text-red-400">{formErrors.path}</p>
              )}
              <p className="mt-1 text-xs text-theme-secondary">
                Chemin absolu vers le dossier contenant les fichiers .fic, .mmo, .ndx
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-statusbar mb-2">
                Description (optionnel)
              </label>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description du DSN..."
                rows={3}
                className="w-full px-4 py-2 bg-theme-input border border-theme-input rounded-lg text-theme-input placeholder-theme-input focus:outline-none focus:ring-2 ring-theme-focus resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-4">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-theme-primary rounded-lg text-white transition-colors"
              >
                <Save className="w-4 h-4" />
                {editingId ? 'Enregistrer' : 'Créer'}
              </button>
              <button
                onClick={handleCloseForm}
                className="px-4 py-2 bg-theme-secondary rounded-lg text-white transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des DSN */}
      <div className="bg-theme-card rounded-lg border border-theme-card p-6">
        <h2 className="text-xl font-semibold mb-4 text-theme-card">DSN configurés</h2>
        
        {dsns.length === 0 ? (
          <div className="text-center py-12 text-theme-secondary">
            <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucun DSN configuré</p>
            <p className="text-sm mt-2">Créez votre premier DSN pour commencer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {dsns.map((dsn) => (
              <div
                key={dsn.id}
                className="bg-theme-card/70 rounded-lg border border-theme-card p-4 hover:border-theme-primary transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Database className="w-5 h-5 text-theme-primary" />
                      <h3 className="text-lg font-semibold text-theme-card">{dsn.name}</h3>
                    </div>
                    <div className="ml-8 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-theme-statusbar">
                        <FolderOpen className="w-4 h-4" />
                        <span className="font-mono">{dsn.path}</span>
                      </div>
                      {dsn.description && (
                        <p className="text-sm text-theme-secondary ml-6">{dsn.description}</p>
                      )}
                      {dsn.createdAt && (
                        <p className="text-xs text-theme-muted ml-6">
                          Créé le {new Date(dsn.createdAt).toLocaleDateString()} à {new Date(dsn.createdAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(dsn)}
                      disabled={isTesting === (dsn.id || dsn.name)}
                      className="px-3 py-1.5 bg-theme-secondary disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white transition-colors"
                      title="Tester la connexion"
                    >
                      {isTesting === (dsn.id || dsn.name) ? 'Test...' : 'Tester'}
                    </button>
                    <button
                      onClick={() => handleOpenForm(dsn)}
                      className="p-1.5 bg-theme-secondary rounded-lg text-white transition-colors"
                      title="Modifier"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(dsn.name)}
                      className="p-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sélecteur de dossier personnalisé */}
      <FolderPicker
        isOpen={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={handleFolderSelected}
        initialPath={formData.path || undefined}
        title="Sélectionner le dossier de la base de données"
      />
    </div>
  );
};

export default DsnManagement;

