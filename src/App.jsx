import React, { useState, useEffect, useMemo, createContext, useContext } from 'react';
import { initializeApp, FirebaseError } from 'firebase/app';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc,
    query,
    writeBatch
} from 'firebase/firestore';
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { AlertTriangle, ArrowUpDown, PlusCircle, CheckCircle, Trash2, Edit, Star, Linkedin, Mail, ExternalLink, X, Users, Kanban, ChevronLeft, Folder, ChevronsUpDown, FolderPlus, UserPlus, Database, Phone, LogOut } from 'lucide-react';

// --- INICIALIZAÇÃO SEGURA DO FIREBASE ---
let app;
let db;
let auth;
let firebaseInitializationError = null;
let firebaseConfig = {};

// O ID do aplicativo é obtido do ambiente, com um fallback.
let appId = (typeof __app_id !== 'undefined') ? __app_id : 'investidores-pacta-default';

try {
    // Carrega a configuração a partir de variáveis globais injetadas pelo ambiente de produção (Vercel/Canvas).
    if (typeof __firebase_config !== 'undefined') {
        firebaseConfig = JSON.parse(__firebase_config);
    } else {
        // Se as variáveis globais não estiverem presentes, lança um erro claro.
        // Esta abordagem remove a dependência do `import.meta.env`, que causava erros de build,
        // focando no funcionamento em produção. Para desenvolvimento local, as variáveis
        // de ambiente precisam ser injetadas de outra forma ou o código adaptado.
        throw new Error("A configuração do Firebase não foi encontrada. Verifique se as Environment Variables estão definidas na Vercel.");
    }

    // Validação crucial para evitar a tela branca de erro.
    if (!firebaseConfig.projectId || !firebaseConfig.apiKey) {
        throw new Error("A configuração do Firebase está incompleta. Verifique as chaves de API nas 'Project Settings'.");
    }

    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (error) {
    console.error("ERRO CRÍTICO NA INICIALIZAÇÃO DO FIREBASE:", error);
    firebaseInitializationError = error.message;
}


// --- CONTEXTO PARA DADOS GLOBAIS ---
const DataContext = createContext();

// --- COMPONENTES DA UI ---

const FullPageLoader = ({ text = "A carregar Investidores Pacta..."}) => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
        <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
            <p className="text-white text-lg mt-4">{text}</p>
        </div>
    </div>
);

const Modal = ({ children, isOpen, onClose, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-700 animate-fade-in-up">
                <div className="flex justify-between items-center p-5 border-b border-gray-700">
                    <h3 className="text-xl font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                </div>
                <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
            </div>
            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

// NOVO: Componente para confirmações, substituindo window.confirm
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <p className="text-gray-300 mb-6">{message}</p>
            <div className="flex justify-end gap-3">
                <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancelar</button>
                <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700">Confirmar</button>
            </div>
        </Modal>
    );
};

// NOVO: Componente para notificações "Toast"
const Toast = ({ message, type = 'success', onDismiss }) => {
    useEffect(() => {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
    }, [onDismiss]);

    const colors = {
        success: 'bg-green-600 border-green-500',
        error: 'bg-red-600 border-red-500',
    };

    return (
        <div className={`fixed bottom-5 right-5 z-50 p-4 rounded-lg shadow-xl text-white border-l-4 ${colors[type]} animate-fade-in-right`}>
            {message}
            <button onClick={onDismiss} className="absolute top-1 right-1 text-white/70 hover:text-white">
                <X size={16} />
            </button>
             <style>{`
                @keyframes fade-in-right {
                    from { opacity: 0; transform: translateX(100%); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-fade-in-right { animation: fade-in-right 0.5s ease-out forwards; }
            `}</style>
        </div>
    );
};


const InputField = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <input {...props} className="w-full bg-gray-900 border border-gray-600 rounded-md p-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
    </div>
);

const SelectField = ({ label, children, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <select {...props} className="w-full bg-gray-900 border border-gray-600 rounded-md p-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition">{children}</select>
    </div>
);

const TextareaField = ({ label, ...props }) => (
    <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
        <textarea {...props} rows="3" className="w-full bg-gray-900 border border-gray-600 rounded-md p-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition" />
    </div>
);


const EditableStarRating = ({ score, onSave }) => {
    const [hoverScore, setHoverScore] = useState(0);
    const handleClick = (newScore) => onSave(newScore);
    return (
        <div className="flex items-center" onMouseLeave={() => setHoverScore(0)} onClick={(e) => e.stopPropagation()}>
            {[...Array(5)].map((_, i) => {
                const currentScore = i + 1;
                return (<Star key={i} size={18} className={`cursor-pointer transition-colors ${(hoverScore || score) >= currentScore ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} onMouseEnter={() => setHoverScore(currentScore)} onClick={() => handleClick(currentScore)}/>);
            })}
        </div>
    );
};

const ProjectForm = ({ projectToEdit, onClose }) => {
    const { userId, showToast } = useContext(DataContext);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => { if (projectToEdit) setFormData({ name: projectToEdit.name, description: projectToEdit.description }); }, [projectToEdit]);
    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleSubmit = async (e) => {
        e.preventDefault(); if (!userId) return; setIsSaving(true);
        try {
            if (projectToEdit) {
                 await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'projects', projectToEdit.id), formData);
                 showToast("Projeto atualizado com sucesso!", 'success');
            } else {
                 await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'projects'), { ...formData, createdAt: new Date() });
                 showToast("Projeto criado com sucesso!", 'success');
            }
            onClose();
        } catch (error) { 
            console.error("Erro ao salvar projeto:", error); 
            showToast("Ocorreu um erro ao salvar o projeto.", 'error');
        } 
        finally { setIsSaving(false); }
    };
    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <InputField label="Nome do Projeto" name="name" value={formData.name} onChange={handleChange} required />
            <TextareaField label="Descrição do Projeto" name="description" value={formData.description} onChange={handleChange} />
            <div className="flex justify-end pt-4 gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancelar</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">{isSaving ? 'A guardar...' : 'Guardar Projeto'}</button>
            </div>
        </form>
    );
};

const CsvImportModal = ({ onClose }) => {
    const { userId, showToast } = useContext(DataContext);
    const [csvData, setCsvData] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const expectedHeaders = "NomeFantasia;Classificação;Tipo;Setor;Crédito/Equity;Nota;Justificativa;Email 1;Email 2;Telefone;Linkedin";
    const handleImport = async () => {
        if (!csvData.trim()) { 
            showToast("Por favor, cole os dados do seu CSV.", 'error');
            return; 
        }
        setIsImporting(true);
        const lines = csvData.trim().split('\n');
        const headers = lines.shift().trim().split(';').map(h => h.trim());
        const investorsToImport = lines.map(line => {
            const values = line.trim().split(';');
            return headers.reduce((obj, header, index) => { obj[header] = values[index] ? values[index].trim() : ''; return obj; }, {});
        });
        try {
            const batch = writeBatch(db);
            const investorsCollection = collection(db, 'artifacts', appId, 'users', userId, 'investors');
            investorsToImport.forEach(investorData => {
                const newInvestorRef = doc(investorsCollection);
                const mappedData = {
                    nomeFantasia: investorData['NomeFantasia'] || '', classificacao: investorData['Classificação'] || '', tipo: investorData['Tipo'] || '',
                    setor: investorData['Setor'] || '', creditoEquity: investorData['Crédito/Equity'] || '', nota: parseInt(investorData['Nota'], 10) || 0,
                    justificativa: investorData['Justificativa'] || '', email1: investorData['Email 1'] || '', email2: investorData['Email 2'] || '',
                    telefone: investorData['Telefone'] || '', linkedin: investorData['Linkedin'] || '', dataDeCriacao: new Date()
                };
                batch.set(newInvestorRef, mappedData);
            });
            await batch.commit();
            showToast(`${investorsToImport.length} investidores importados com sucesso!`, 'success');
            onClose();
        } catch (error) { 
            console.error("Erro ao importar CSV:", error); 
            showToast("Ocorreu um erro na importação.", 'error');
        } 
        finally { setIsImporting(false); }
    };
    return (
        <>
            <p className="text-gray-300 mb-4">Cole o conteúdo do seu arquivo CSV. A primeira linha deve ser o cabeçalho:</p>
            <p className="text-sm bg-gray-900 p-2 rounded-md text-gray-400 mb-4 break-words">{expectedHeaders}</p>
            <TextareaField label="Dados do CSV" value={csvData} onChange={(e) => setCsvData(e.target.value)} rows={10} placeholder={`${expectedHeaders}\nExemplo de linha...`} />
            <div className="flex justify-end pt-4 gap-3">
                <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancelar</button>
                <button onClick={handleImport} disabled={isImporting} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400">{isImporting ? 'A importar...' : 'Importar'}</button>
            </div>
        </>
    );
};

const AddInvestorToProjectModal = ({ onClose, selectedProjectId }) => {
    const { userId, masterInvestors, projectInvestors, showToast } = useContext(DataContext);
    const [selectedInvestors, setSelectedInvestors] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [classificationFilter, setClassificationFilter] = useState('');
    const [sectorFilter, setSectorFilter] = useState('');

    const uniqueClassifications = useMemo(() => [...new Set(masterInvestors.map(item => item.classificacao).filter(Boolean))], [masterInvestors]);
    const uniqueSectors = useMemo(() => [...new Set(masterInvestors.map(item => item.setor).filter(Boolean))], [masterInvestors]);

    const availableInvestors = useMemo(() => {
        const projectInvestorIds = new Set(projectInvestors.map(pi => pi.id));
        return masterInvestors.filter(mi => 
            !projectInvestorIds.has(mi.id) &&
            (classificationFilter === '' || mi.classificacao === classificationFilter) &&
            (sectorFilter === '' || mi.setor === sectorFilter)
        );
    }, [masterInvestors, projectInvestors, classificationFilter, sectorFilter]);

    const toggleSelection = (investorId) => setSelectedInvestors(prev => prev.includes(investorId) ? prev.filter(id => id !== investorId) : [...prev, investorId]);
    
    const handleAdd = async () => {
        if (selectedInvestors.length === 0) return;
        setIsAdding(true);
        try {
            const batch = writeBatch(db);
            selectedInvestors.forEach(investorId => {
                const pipelineRef = doc(db, 'artifacts', appId, 'users', userId, 'projects', selectedProjectId, 'pipeline', investorId);
                batch.set(pipelineRef, { notaDePrioridade: 3, status: 'Não Contatado', historicoDeInteracoes: [] });
            });
            await batch.commit();
            showToast(`${selectedInvestors.length} investidor(es) adicionado(s) com sucesso!`, 'success');
            onClose();
        } catch (error) { 
            console.error("Erro ao adicionar investidores:", error); 
            showToast("Falha ao adicionar investidores.", 'error');
        }
        finally { setIsAdding(false); }
    };

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <SelectField label="Filtrar por Classificação" value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)}>
                    <option value="">Todas as Classificações</option> 
                    {uniqueClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                </SelectField>
                <SelectField label="Filtrar por Setor" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
                    <option value="">Todos os Setores</option> 
                    {uniqueSectors.map(s => <option key={s} value={s}>{s}</option>)}
                </SelectField>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {availableInvestors.map(investor => (
                    <div key={investor.id} onClick={() => toggleSelection(investor.id)} className={`flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${selectedInvestors.includes(investor.id) ? 'bg-blue-900 border border-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                        <div className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center ${selectedInvestors.includes(investor.id) ? 'bg-blue-600 border-blue-500' : 'border-gray-500'}`}>
                            {selectedInvestors.includes(investor.id) && <CheckCircle size={16} className="text-white" />}
                        </div>
                        <div>
                            <p className="font-medium text-white">{investor.nomeFantasia}</p>
                            <p className="text-sm text-gray-400">{investor.setor}</p>
                        </div>
                    </div>
                ))}
                 {availableInvestors.length === 0 && <p className="text-gray-500 text-center py-8">Nenhum investidor disponível com este filtro.</p>}
            </div>
            <div className="flex justify-end pt-4 gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700">Cancelar</button>
                <button onClick={handleAdd} disabled={isAdding || selectedInvestors.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400">{isAdding ? 'A adicionar...' : `Adicionar ${selectedInvestors.length}`}</button>
            </div>
        </>
    );
};

const ProjectSelector = () => {
    const { projects, selectedProjectId, setSelectedProjectId, setIsProjectModalOpen, setIsCsvModalOpen } = useContext(DataContext);
    const [isOpen, setIsOpen] = useState(false);
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    return (
        <div className="relative w-full">
            <button onClick={() => setIsOpen(!isOpen)} className="w-full bg-gray-700 p-3 rounded-lg flex justify-between items-center text-left">
                <div>
                    <p className="text-xs text-gray-400">Projeto Atual</p>
                    <p className="font-semibold text-white truncate">{selectedProject?.name || 'Nenhum Projeto'}</p>
                </div>
                <ChevronsUpDown size={20} className="text-gray-400" />
            </button>
            {isOpen && (
                <div className="absolute top-full mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 p-2">
                    {projects.map(project => (<div key={project.id} onClick={() => { setSelectedProjectId(project.id); setIsOpen(false); }} className="p-3 hover:bg-gray-700 rounded-md cursor-pointer text-white">{project.name}</div>))}
                    <div className="border-t border-gray-700 my-2"></div>
                    <div onClick={() => { setIsProjectModalOpen(true); setIsOpen(false); }} className="p-3 text-blue-400 hover:bg-gray-700 rounded-md cursor-pointer flex items-center gap-2"><FolderPlus size={18} /> Novo Projeto</div>
                    <div onClick={() => { setIsCsvModalOpen(true); setIsOpen(false); }} className="p-3 text-green-400 hover:bg-gray-700 rounded-md cursor-pointer flex items-center gap-2"><UserPlus size={18} /> Importar Base</div>
                </div>
            )}
        </div>
    );
};

const MasterInvestorList = ({ onSelectInvestor }) => {
    const { masterInvestors, userId, showToast } = useContext(DataContext);
    const [searchTerm, setSearchTerm] = useState('');
    const [filters, setFilters] = useState({ classificacao: '', setor: '', creditoEquity: '' });
    const [investorToDelete, setInvestorToDelete] = useState(null); // Para o modal de confirmação
    
    const uniqueClassifications = useMemo(() => [...new Set(masterInvestors.map(item => item.classificacao).filter(Boolean))], [masterInvestors]);
    const uniqueSectors = useMemo(() => [...new Set(masterInvestors.map(item => item.setor).filter(Boolean))], [masterInvestors]);

    const filteredInvestors = useMemo(() => {
        return masterInvestors.filter(investor => {
            const searchMatch = searchTerm === '' || investor.nomeFantasia.toLowerCase().includes(searchTerm.toLowerCase()) || (investor.setor && investor.setor.toLowerCase().includes(searchTerm.toLowerCase()));
            const filterMatch = Object.entries(filters).every(([key, value]) => value === '' || investor[key] === value);
            return searchMatch && filterMatch;
        });
    }, [masterInvestors, searchTerm, filters]);

    const handleDeleteClick = (e, investor) => {
        e.stopPropagation();
        setInvestorToDelete(investor); // Abre o modal de confirmação
    };

    const confirmDelete = async () => {
        if (!investorToDelete) return;
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'investors', investorToDelete.id));
            showToast(`${investorToDelete.nomeFantasia} foi excluído.`, 'success');
        } catch (error) {
            console.error("Erro ao excluir investidor:", error);
            showToast("Falha ao excluir.", 'error');
        } finally {
            setInvestorToDelete(null); // Fecha o modal
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
             <ConfirmationModal 
                isOpen={!!investorToDelete}
                onClose={() => setInvestorToDelete(null)}
                onConfirm={confirmDelete}
                title="Confirmar Exclusão"
                message={`Tem a certeza de que deseja excluir ${investorToDelete?.nomeFantasia} da base central? Esta ação é irreversível.`}
            />
            <h2 className="text-3xl font-bold text-white mb-6">Base Central de Investidores</h2>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                    <div className="lg:col-span-2"><InputField placeholder="Procurar por nome, setor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                    <SelectField value={filters.classificacao} onChange={(e) => setFilters(f => ({...f, classificacao: e.target.value}))}>
                        <option value="">Classificação</option>{uniqueClassifications.map(v => <option key={v} value={v}>{v}</option>)}
                    </SelectField>
                    <SelectField value={filters.setor} onChange={(e) => setFilters(f => ({...f, setor: e.target.value}))}>
                        <option value="">Setor</option>{uniqueSectors.map(v => <option key={v} value={v}>{v}</option>)}
                    </SelectField>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-gray-300">
                        <thead className="bg-gray-700 text-gray-200 uppercase text-sm"><tr><th className="p-4">Nome Fantasia</th><th className="p-4">Classificação</th><th className="p-4">Setor</th><th className="p-4">Nota Global</th><th className="p-4">Ações</th></tr></thead>
                        <tbody className="divide-y divide-gray-700">
                           {filteredInvestors.map(investor => (
                                <tr key={investor.id} onClick={() => onSelectInvestor(investor, true)} className="hover:bg-gray-700 cursor-pointer">
                                    <td className="p-4 font-medium text-white">{investor.nomeFantasia}</td><td className="p-4">{investor.classificacao}</td><td className="p-4">{investor.setor}</td>
                                    <td className="p-4"><div className="flex items-center">{[...Array(5)].map((_, i) => <Star key={i} size={18} className={i < (investor.nota || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />)}</div></td>
                                    <td className="p-4"><button onClick={(e) => handleDeleteClick(e, investor)} className="text-gray-400 hover:text-red-500 p-2 rounded-full transition-colors"><Trash2 size={18} /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredInvestors.length === 0 && <p className="text-center py-10 text-gray-500">Nenhum investidor encontrado.</p>}
                </div>
            </div>
        </div>
    );
};

const Dashboard = ({ onSelectInvestor }) => {
    const { projectInvestors, selectedProjectId, userId } = useContext(DataContext);
    const [isAddInvestorModalOpen, setIsAddInvestorModalOpen] = useState(false);
    const sortedAndFilteredInvestors = useMemo(() => [...projectInvestors].sort((a,b) => (b.notaDePrioridade || 0) - (a.notaDePrioridade || 0)), [projectInvestors]);
    const handleActionClick = (e) => e.stopPropagation();
    
    const handlePriorityChange = async (investorId, newPriority) => {
        if (!userId || !selectedProjectId) return;
        const pipelineRef = doc(db, 'artifacts', appId, 'users', userId, 'projects', selectedProjectId, 'pipeline', investorId);
        try { await updateDoc(pipelineRef, { notaDePrioridade: newPriority }); } 
        catch (error) { console.error("Erro ao atualizar prioridade:", error); }
    };

    if (!selectedProjectId) return <div className="flex flex-col items-center justify-center h-full text-center p-8"><Folder size={64} className="text-gray-600 mb-4" /><h2 className="text-2xl font-bold text-white">Nenhum projeto selecionado</h2><p className="text-gray-400 mt-2">Crie ou selecione um projeto na barra lateral.</p></div>
    
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
                     <h2 className="text-2xl font-bold text-white">Investidores no Projeto</h2>
                    <button onClick={() => setIsAddInvestorModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"><PlusCircle size={20} /><span>Adicionar</span></button>
                </div>
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-gray-300">
                        <thead className="bg-gray-700 text-gray-200 uppercase text-sm"><tr><th className="p-4">Nome</th><th className="p-4">Setor</th><th className="p-4">Prioridade (Projeto)</th><th className="p-4">Status</th><th className="p-4">Ações</th></tr></thead>
                        <tbody className="divide-y divide-gray-700">
                           {sortedAndFilteredInvestors.map(investor => (
                                <tr key={investor.id} onClick={() => onSelectInvestor(investor)} className="hover:bg-gray-700 cursor-pointer">
                                    <td className="p-4 font-medium text-white">{investor.nomeFantasia}</td><td className="p-4">{investor.setor}</td>
                                    <td className="p-4"><EditableStarRating score={investor.notaDePrioridade || 0} onSave={(newPriority) => handlePriorityChange(investor.id, newPriority)} /></td>
                                    <td className="p-4"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${ {'Não Contatado':'bg-gray-600 text-gray-100', 'Contatado':'bg-blue-600 text-blue-100', 'Reunião Agendada':'bg-yellow-600 text-yellow-100', 'Em Análise':'bg-purple-600 text-purple-100', 'Investido':'bg-green-600 text-green-100', 'Recusado':'bg-red-600 text-red-100'}[investor.status] || 'bg-gray-500' }`}>{investor.status}</span></td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            {investor.email1 && <a href={`mailto:${investor.email1}`} onClick={handleActionClick} className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-blue-600"><Mail size={18}/></a>}
                                            {investor.linkedin && <a href={investor.linkedin} target="_blank" rel="noopener noreferrer" onClick={handleActionClick} className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-blue-600"><Linkedin size={18}/></a>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                     {sortedAndFilteredInvestors.length === 0 && <div className="text-center py-10 text-gray-500"><p>Nenhum investidor neste projeto.</p><p>Clique em "Adicionar" para incluir investidores da sua base central.</p></div>}
               </div>
            </div>
            <Modal isOpen={isAddInvestorModalOpen} onClose={() => setIsAddInvestorModalOpen(false)} title="Adicionar Investidor ao Projeto"><AddInvestorToProjectModal onClose={() => setIsAddInvestorModalOpen(false)} selectedProjectId={selectedProjectId} /></Modal>
        </div>
    );
};

const KanbanBoard = ({ onSelectInvestor }) => {
    const { projectInvestors, userId, selectedProjectId } = useContext(DataContext);
    const statuses = ['Não Contatado', 'Contatado', 'Reunião Agendada', 'Em Análise', 'Investido', 'Recusado'];
    
    const handleDrop = async (e, newStatus) => {
        const investorId = e.dataTransfer.getData("investorId"); if (!investorId || !userId || !selectedProjectId) return;
        try { await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'projects', selectedProjectId, 'pipeline', investorId), { status: newStatus }); } catch (e) { console.error("Erro ao mover investidor:", e); }
    };
    
    const handleDragStart = (e, investorId) => e.dataTransfer.setData("investorId", investorId);
    const handleDragOver = (e) => e.preventDefault();
    const handleActionClick = (e) => e.stopPropagation();

    const handlePriorityChange = async (investorId, newPriority) => {
        if (!userId || !selectedProjectId) return;
        try { await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'projects', selectedProjectId, 'pipeline', investorId), { notaDePrioridade: newPriority }); } catch (e) { console.error("Erro ao atualizar prioridade:", e); }
    };

    if (!selectedProjectId) return <div className="flex flex-col items-center justify-center h-full text-center p-8"><Folder size={64} className="text-gray-600 mb-4" /><h2 className="text-2xl font-bold text-white">Nenhum projeto selecionado</h2><p className="text-gray-400 mt-2">Selecione um projeto para ver o pipeline.</p></div>

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 sm:p-6 lg:p-8 shrink-0"><h2 className="text-3xl font-bold text-white">Pipeline de Investimentos</h2></div>
            <div className="flex-grow flex gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8 pb-4">
                {statuses.map(status => (
                    <div key={status} className="bg-gray-800 rounded-lg w-80 shrink-0 flex flex-col" onDrop={(e) => handleDrop(e, status)} onDragOver={handleDragOver}>
                          <h3 className={`font-bold text-lg p-4 rounded-t-lg border-b-4 ${ {'Não Contatado':'border-gray-500 text-gray-200', 'Contatado':'border-blue-500 text-blue-200', 'Reunião Agendada':'border-yellow-500 text-yellow-200', 'Em Análise':'border-purple-500 text-purple-200', 'Investido':'border-green-500 text-green-200', 'Recusado':'border-red-500 text-red-200'}[status] }`}>{status}</h3>
                        <div className="p-4 space-y-4 overflow-y-auto h-full">
                           {projectInvestors.filter(inv => inv.status === status).map(investor => (
                                <div key={investor.id} className="bg-gray-700 p-4 rounded-md shadow-md cursor-pointer hover:bg-gray-600" draggable onDragStart={(e) => handleDragStart(e, investor.id)} onClick={() => onSelectInvestor(investor)}>
                                    <p className="font-semibold text-white">{investor.nomeFantasia}</p>
                                    <div className="my-2"><EditableStarRating score={investor.notaDePrioridade || 0} onSave={(newPriority) => handlePriorityChange(investor.id, newPriority)} /></div>
                                    <div className="flex items-center gap-2 pt-3 border-t border-gray-600">
                                        {investor.email1 && <a href={`mailto:${investor.email1}`} onClick={handleActionClick} className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-blue-600"><Mail size={16}/></a>}
                                        {investor.linkedin && <a href={investor.linkedin} target="_blank" rel="noopener noreferrer" onClick={handleActionClick} className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-blue-600"><Linkedin size={16}/></a>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const InvestorProfile = ({ investor, onBack, isMasterProfile }) => {
    const { userId, selectedProjectId, showToast } = useContext(DataContext);
    const [interactionType, setInteractionType] = useState('Email');
    const [interactionNotes, setInteractionNotes] = useState('');

    const handleAddInteraction = async (e) => {
        e.preventDefault(); 
        if (!interactionNotes.trim() || !userId || !selectedProjectId || isMasterProfile) return;
        
        const newInteraction = { data: new Date(), tipo: interactionType, anotacoes: interactionNotes };
        
        try {
            // Firestore timestamps need to be converted when updating arrays
            const existingInteractions = investor.historicoDeInteracoes ? investor.historicoDeInteracoes.map(item => ({...item, data: item.data.toDate()})) : [];

            await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'projects', selectedProjectId, 'pipeline', investor.id), { 
                historicoDeInteracoes: [...existingInteractions, newInteraction] 
            });

            setInteractionNotes('');
            showToast("Interação adicionada com sucesso!", 'success');
        } catch (error) { 
            console.error("Erro ao adicionar interação:", error); 
            showToast("Erro ao adicionar interação.", 'error');
        }
    };
    
    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <button onClick={onBack} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6"><ChevronLeft size={20} /> Voltar</button>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 mb-6">
                 <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-white">{investor.nomeFantasia}</h2><p className="text-gray-400 mt-1">{investor.setor}</p>
                        <div className="flex items-center mt-2"><p className="text-gray-400 mr-2">Nota Geral:</p>{[...Array(5)].map((_, i) => <Star key={i} size={22} className={i < (investor.nota || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'} />)}</div>
                    </div>
                     <div className="flex items-center gap-3 shrink-0">{investor.linkedin && <a href={investor.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-700 rounded-full hover:bg-blue-600"><Linkedin size={20} className="text-white"/></a>}</div>
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                     <div className="bg-gray-800 rounded-lg shadow-xl p-6">
                         <h3 className="text-xl font-bold text-white mb-4">Detalhes do Investidor</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
                              <div><strong className="text-gray-400 block">Classificação:</strong> {investor.classificacao}</div><div><strong className="text-gray-400 block">Tipo:</strong> {investor.tipo}</div><div><strong className="text-gray-400 block">Crédito/Equity:</strong> {investor.creditoEquity}</div>
                         </div>
                         <div className="mt-4"><strong className="text-gray-400 block">Justificativa:</strong> <p className="mt-1">{investor.justificativa}</p></div>
                    </div>
                    {!isMasterProfile && (
                        <>
                        <div className="bg-gray-800 rounded-lg shadow-xl p-6">
                               <h3 className="text-xl font-bold text-white mb-4">Adicionar Interação (Projeto)</h3>
                               <form onSubmit={handleAddInteraction} className="space-y-4">
                                   <SelectField label="Tipo" value={interactionType} onChange={(e) => setInteractionType(e.target.value)}><option>Email</option><option>Chamada</option><option>Reunião</option><option>LinkedIn</option><option>Outro</option></SelectField>
                                   <TextareaField label="Anotações" placeholder="Descreva a interação..." value={interactionNotes} onChange={(e) => setInteractionNotes(e.target.value)} required />
                                   <div className="text-right"><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Adicionar</button></div>
                               </form>
                           </div>
                           <div className="bg-gray-800 rounded-lg shadow-xl p-6">
                               <h3 className="text-xl font-bold text-white mb-4">Histórico (Projeto)</h3>
                                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                                   {investor.historicoDeInteracoes && [...investor.historicoDeInteracoes].reverse().map((item, index) => (
                                       <div key={index} className="bg-gray-700 p-4 rounded-md">
                                           <div className="flex justify-between items-center text-sm mb-1"><p className="font-semibold text-blue-400">{item.tipo}</p><p className="text-gray-400">{item.data.toDate ? new Date(item.data.toDate()).toLocaleString('pt-BR') : new Date(item.data).toLocaleString('pt-BR')}</p></div><p className="text-gray-300">{item.anotacoes}</p>
                                       </div>
                                   ))}
                                   {(!investor.historicoDeInteracoes || investor.historicoDeInteracoes.length === 0) && <p className="text-gray-500 text-center py-4">Nenhuma interação registada.</p>}
                               </div>
                           </div>
                        </>
                    )}
                </div>
                 <div className="bg-gray-800 rounded-lg shadow-xl p-6 self-start">
                    <h3 className="text-xl font-bold text-white mb-4">Contactos</h3>
                    <ul className="space-y-3 text-gray-300">
                        <li className="flex items-start gap-3"><Mail size={18} className="text-gray-500 mt-1"/><span>{investor.email1 || 'Não informado'}</span></li>
                         <li className="flex items-start gap-3"><Mail size={18} className="text-gray-500 mt-1"/><span>{investor.email2 || 'Não informado'}</span></li>
                        <li className="flex items-start gap-3"><Phone size={18} className="text-gray-500 mt-1"/><span>{investor.telefone || 'Não informado'}</span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

// --- COMPONENTE PRINCIPAL APP ---
export default function App() {
    const [userId, setUserId] = useState(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isDataLoading, setIsDataLoading] = useState(true);
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [masterInvestors, setMasterInvestors] = useState([]);
    const [projectInvestors, setProjectInvestors] = useState([]);
    const [currentPage, setCurrentPage] = useState('dashboard');
    const [selectedInvestor, setSelectedInvestor] = useState(null);
    const [isMasterProfile, setIsMasterProfile] = useState(false);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ message, type, id: Date.now() });
    };

    // Efeito para autenticação
    useEffect(() => {
        if(firebaseInitializationError) { setIsAuthLoading(false); return; }
        const unsub = onAuthStateChanged(auth, user => {
            setUserId(user ? user.uid : null);
            setIsAuthLoading(false);
        });
        return () => unsub();
    }, []);

    // Efeito para carregar dados do utilizador (projetos e base de investidores)
    useEffect(() => {
        if (!userId) {
            setProjects([]); 
            setMasterInvestors([]);
            setIsDataLoading(false);
            return;
        }

        setIsDataLoading(true);
        const projectsQuery = query(collection(db, 'artifacts', appId, 'users', userId, 'projects'));
        const unsubProjects = onSnapshot(projectsQuery, snap => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setProjects(data);
            // Define o primeiro projeto como selecionado se nenhum estiver
            if (data.length > 0 && !selectedProjectId) {
                setSelectedProjectId(data[0].id);
            } else if (data.length === 0) {
                setSelectedProjectId(null);
            }
        }, error => console.error("Erro ao buscar projetos:", error));

        const investorsQuery = query(collection(db, 'artifacts', appId, 'users', userId, 'investors'));
        const unsubInvestors = onSnapshot(investorsQuery, snap => {
            setMasterInvestors(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsDataLoading(false); // Marca o fim do carregamento de dados
        }, error => {
            console.error("Erro ao buscar investidores:", error);
            setIsDataLoading(false);
        });
        
        return () => { unsubProjects(); unsubInvestors(); };
    }, [userId]);

    // Efeito para carregar o pipeline do projeto selecionado
    useEffect(() => {
        if (!selectedProjectId || !userId) { 
            setProjectInvestors([]); 
            return; 
        };
        
        const pipelineQuery = query(collection(db, 'artifacts', appId, 'users', userId, 'projects', selectedProjectId, 'pipeline'));
        const unsubPipeline = onSnapshot(pipelineQuery, (pipelineSnap) => {
            const investorsInProject = pipelineSnap.docs.map(doc => {
                const pipelineData = doc.data();
                const masterData = masterInvestors.find(mi => mi.id === doc.id);
                if (!masterData) return null;
                return { id: doc.id, ...masterData, ...pipelineData };
            }).filter(Boolean); // Remove nulos se o mestre não for encontrado
            setProjectInvestors(investorsInProject);
        }, error => console.error("Erro ao buscar pipeline:", error));
        
        return () => unsubPipeline();
    }, [selectedProjectId, userId, masterInvestors]);

    const handleSelectInvestor = (investor, isMaster = false) => {
        setSelectedInvestor(investor);
        setIsMasterProfile(isMaster);
    };

    const handleBack = () => setSelectedInvestor(null);
    
    if (firebaseInitializationError) return <FirebaseErrorDisplay error={firebaseInitializationError} />;
    if (isAuthLoading || isDataLoading) return <FullPageLoader />;
    if (!userId) return <LoginPage showToast={showToast}/>;
    
    const renderContent = () => {
        if (selectedInvestor) return <InvestorProfile investor={selectedInvestor} onBack={handleBack} isMasterProfile={isMasterProfile} />;
        switch (currentPage) {
            case 'master_list': return <MasterInvestorList onSelectInvestor={handleSelectInvestor} />;
            case 'dashboard': return <Dashboard onSelectInvestor={handleSelectInvestor} />;
            case 'kanban': return <KanbanBoard onSelectInvestor={handleSelectInvestor} />;
            default: return <Dashboard onSelectInvestor={handleSelectInvestor} />;
        }
    }

    return (
        <DataContext.Provider value={{ userId, projects, selectedProjectId, setSelectedProjectId, masterInvestors, projectInvestors, setIsProjectModalOpen, setIsCsvModalOpen, showToast }}>
            {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
            <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col sm:flex-row">
                 <nav className="bg-gray-800 p-4 flex sm:flex-col items-center gap-4 border-b sm:border-b-0 sm:border-r border-gray-700 w-full sm:w-64 shrink-0">
                    <div className="text-blue-500 font-bold text-2xl hidden sm:block mb-4">Investidores Pacta</div>
                    <div className="w-full"><ProjectSelector /></div>
                    <div className="flex sm:flex-col items-center gap-2 w-full mt-0 sm:mt-4">
                        <button onClick={() => { setCurrentPage('master_list'); setSelectedInvestor(null); }} className={`p-3 rounded-lg flex items-center gap-3 w-full transition-colors ${currentPage === 'master_list' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><Database size={20} /><span className="hidden sm:inline">Base de Investidores</span></button>
                        <div className="border-t border-gray-700 w-full my-2 hidden sm:block"></div>
                        <p className="text-xs text-gray-500 uppercase font-bold hidden sm:block w-full px-3">Projeto Ativo</p>
                        <button onClick={() => { setCurrentPage('dashboard'); setSelectedInvestor(null); }} className={`p-3 rounded-lg flex items-center gap-3 w-full transition-colors ${currentPage === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><Users size={20} /><span className="hidden sm:inline">Dashboard</span></button>
                        <button onClick={() => { setCurrentPage('kanban'); setSelectedInvestor(null); }} className={`p-3 rounded-lg flex items-center gap-3 w-full transition-colors ${currentPage === 'kanban' ? 'bg-blue-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}><Kanban size={20} /><span className="hidden sm:inline">Pipeline</span></button>
                        <div className="flex-grow"></div>
                        <button onClick={() => signOut(auth)} className="p-3 rounded-lg flex items-center gap-3 w-full text-red-400 hover:bg-red-900/50"><LogOut size={20} /><span className="hidden sm:inline">Sair</span></button>
                    </div>
                </nav>
                <main className="flex-grow h-screen-minus-header sm:h-screen overflow-y-auto">{renderContent()}</main>
            </div>
            <Modal isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} title={selectedProjectId ? "Editar Projeto" : "Novo Projeto"}><ProjectForm onClose={() => setIsProjectModalOpen(false)}/></Modal>
            <Modal isOpen={isCsvModalOpen} onClose={() => setIsCsvModalOpen(false)} title="Importar Base de Investidores (CSV)"><CsvImportModal onClose={() => setIsCsvModalOpen(false)}/></Modal>
            <style>{`.h-screen-minus-header { height: calc(100vh - 88px); } @media (min-width: 640px) { .h-screen-minus-header { height: 100vh; } }`}</style>
        </DataContext.Provider>
    );
}

// --- PÁGINA DE LOGIN / CADASTRO ---
const LoginPage = ({ showToast }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const handleSubmit = async (e) => {
        e.preventDefault(); setError(''); setIsLoading(true);
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                // Opcional: mostrar uma mensagem de sucesso no registo
            }
        } catch (err) {
            let friendlyError = "Ocorreu um erro. Tente novamente.";
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') friendlyError = "E-mail ou senha incorretos.";
            else if (err.code === 'auth/email-already-in-use') friendlyError = "Este e-mail já está em uso.";
            else if (err.code === 'auth/weak-password') friendlyError = "A senha deve ter pelo menos 6 caracteres.";
            setError(friendlyError);
        } finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
             {isLoading && <FullPageLoader text={isLogin ? "A entrar..." : "A criar conta..."} />}
            <div className="w-full max-w-md">
                <div className="text-center mb-8"><h1 className="text-4xl font-bold text-blue-500">Investidores Pacta</h1><p className="text-gray-400">O seu CRM para captação de recursos.</p></div>
                <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
                    <h2 className="text-2xl font-bold text-white text-center mb-6">{isLogin ? 'Login' : 'Criar Conta'}</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <InputField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                        <InputField label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold">{isLogin ? 'Entrar' : 'Registar'}</button>
                    </form>
                    <p className="text-center text-gray-400 text-sm mt-6">{isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}<button onClick={() => setIsLogin(!isLogin)} className="font-semibold text-blue-400 hover:underline ml-1">{isLogin ? 'Registe-se' : 'Faça login'}</button></p>
                </div>
            </div>
        </div>
    );
};

// Componente para exibir erro de inicialização do Firebase
const FirebaseErrorDisplay = ({ error }) => {
    return (
        <div className="min-h-screen bg-red-900/10 text-white flex items-center justify-center p-4">
            <div className="text-center bg-gray-800 p-8 rounded-lg shadow-2xl border border-red-500 max-w-2xl">
                <AlertTriangle className="mx-auto h-12 w-12 text-red-500" />
                <h1 className="text-2xl font-bold mt-4 mb-2">Erro Crítico na Configuração</h1>
                <p className="text-gray-300">Não foi possível conectar à base de dados.</p>
                <div className="mt-4 text-left text-sm text-red-300 bg-red-900/50 p-3 rounded-md">
                    <p><strong>Mensagem do Erro:</strong> {error}</p>
                </div>
                <p className="mt-6 text-gray-400">Por favor, verifique se as 'Environment Variables' no seu painel da Vercel estão corretas e faça o 'Redeploy' do projeto. Consulte o guia para mais detalhes.</p>
            </div>
        </div>
    );
};
