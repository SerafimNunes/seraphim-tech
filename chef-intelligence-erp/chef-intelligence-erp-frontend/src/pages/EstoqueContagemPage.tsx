// chef-intelligence-erp-frontend\src\pages\EstoqueContagemPage.tsx

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Container } from '@mantine/core'; 
import { Title } from '@mantine/core'; 
import { Button } from '@mantine/core'; 
import { Table } from '@mantine/core'; 
import { TextInput } from '@mantine/core'; 
import { Select } from '@mantine/core'; 
import { Text } from '@mantine/core'; 
import { Drawer } from '@mantine/core'; 
import { LoadingOverlay } from '@mantine/core'; 
import { Checkbox } from '@mantine/core'; 
import { Textarea } from '@mantine/core'; 
import { Group } from '@mantine/core';

import { useDisclosure } from '@mantine/hooks';

// 🚨 PONTO CRÍTICO: VERIFIQUE ESTE CAMINHO NO SEU PROJETO
import AppShellLayout from '../components/AppShellLayout'; 


const API_URL = 'http://localhost:3000/api/v1/produtos'; 

// ---------------------------------------------------------------------
// 2. INTERFACES E TIPOS
// ---------------------------------------------------------------------
interface Produto {
    id_produto: number;
    nome: string;
    unidade_medida: string;
    estoque_atual: number;
    estoque_minimo: number;
    preco_custo_unitario: number;
    preco_venda: number; 
    is_vendavel: boolean;
    is_pre_pronto: boolean;
}

interface FormData {
    nome: string;
    unidade_medida: string;
    estoque_minimo: number;
    preco_venda: number; 
    is_vendavel: boolean;
    is_pre_pronto: boolean;
}

interface MovimentoFormData {
    id_produto: number | null;
    nome_produto: string;
    unidade_medida: string;
    quantidade: number; 
    custo_unitario: number; 
    observacoes: string;
}

const initialFormData: FormData = {
    nome: '',
    unidade_medida: 'UN', 
    estoque_minimo: 0,
    preco_venda: 0, 
    is_vendavel: false,
    is_pre_pronto: false,
};

const initialMovimentoFormData: MovimentoFormData = {
    id_produto: null,
    nome_produto: '',
    unidade_medida: 'UN',
    quantidade: 0,
    custo_unitario: 0,
    observacoes: '',
};

// ---------------------------------------------------------------------
// 3. COMPONENTE PRINCIPAL
// ---------------------------------------------------------------------
export default function EstoqueContagemPage() {
    const [produtos, setProdutos] = useState<Produto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [cadastroOpened, { open: openCadastro, close: closeCadastro }] = useDisclosure(false);
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [formLoading, setFormLoading] = useState(false);

    const [entradaOpened, { open: openEntrada, close: closeEntrada }] = useDisclosure(false);
    const [entradaFormData, setEntradaFormData] = useState<MovimentoFormData>(initialMovimentoFormData);
    const [entradaFormLoading, setEntradaFormLoading] = useState(false);


    const fetchProdutos = useCallback(async () => {
        setLoading(true);
        const token = localStorage.getItem('erp_auth_token');
        if (!token) {
            setError('Token de autenticação não encontrado. Faça login.');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setProdutos(response.data);
            setError(null);
        } catch (err) {
            console.error('Erro ao buscar produtos:', err);
            setError('Falha ao carregar a lista de produtos.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProdutos();
    }, [fetchProdutos]);

    const handleOpenEntrada = (produto: Produto) => {
        setEntradaFormData({
            id_produto: produto.id_produto,
            nome_produto: produto.nome,
            unidade_medida: produto.unidade_medida,
            quantidade: 0,
            custo_unitario: parseFloat(produto.preco_custo_unitario.toString()),
            observacoes: '',
        });
        openEntrada();
    };

    // ---------------------------------------------------------------------
    // 4. LÓGICAS DE SUBMISSÃO
    // ---------------------------------------------------------------------

    const handleStore = async (event: React.FormEvent) => {
        event.preventDefault();
        setFormLoading(true);
        const token = localStorage.getItem('erp_auth_token');
        if (!token) {
            setFormLoading(false);
            return;
        }
        
        try {
            const dataToSend = {
                ...formData,
                estoque_minimo: formData.estoque_minimo.toString(),
                preco_venda: formData.preco_venda.toString(), 
            };

            await axios.post(API_URL, dataToSend, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setFormData(initialFormData);
            closeCadastro();
            fetchProdutos(); 
            alert(`✅ Produto ${formData.nome} cadastrado com sucesso!`);

        } catch (err) {
            alert("❌ Erro ao cadastrar produto. Verifique se o produto já existe ou se todos os campos estão válidos.");
        } finally {
            setFormLoading(false);
        }
    };

    const handleEntradaEstoque = async (event: React.FormEvent) => {
        event.preventDefault();
        setEntradaFormLoading(true);
        const token = localStorage.getItem('erp_auth_token');
        if (!token || !entradaFormData.id_produto) {
            alert("❌ Erro de Autenticação ou Produto não selecionado.");
            setEntradaFormLoading(false);
            return;
        }

        const quantidadeParsed = parseFloat(entradaFormData.quantidade.toString());
        const custoUnitarioParsed = parseFloat(entradaFormData.custo_unitario.toString());
        const id_produto = entradaFormData.id_produto;

        if (quantidadeParsed <= 0 || isNaN(quantidadeParsed)) {
            alert("❌ A quantidade de entrada deve ser um valor numérico positivo.");
            setEntradaFormLoading(false);
            return;
        }

        if (custoUnitarioParsed < 0 || isNaN(custoUnitarioParsed)) {
            alert("❌ O Custo Unitário deve ser um valor numérico válido (R$ 0 ou mais).");
            setEntradaFormLoading(false);
            return;
        }

        try {
            const dataToSend = {
                qtd_entrada: quantidadeParsed.toString(), 
                preco_custo_unitario_novo: custoUnitarioParsed.toString(),
                observacoes: entradaFormData.observacoes, 
            };

            await axios.patch(`${API_URL}/${id_produto}/entrada`, dataToSend, { 
                headers: { Authorization: `Bearer ${token}` } 
            });

            setEntradaFormData(initialMovimentoFormData);
            closeEntrada();
            fetchProdutos();
            alert(`✅ Entrada de ${quantidadeParsed} ${entradaFormData.unidade_medida} de ${entradaFormData.nome_produto} registrada com sucesso!`);

        } catch (err: any) {
            const errorMessage = err.response?.data?.error || "Erro desconhecido ao registrar entrada de estoque.";
            alert(`❌ Falha na Entrada: ${errorMessage}`);
        } finally {
            setEntradaFormLoading(false);
        }
    };


    // ---------------------------------------------------------------------
    // 5. RENDERIZAÇÃO DA TABELA (JSX)
    // ---------------------------------------------------------------------
    // ✅ CORREÇÃO CRÍTICA: Removido o useMemo para simplificar a sintaxe e evitar erro de parsing do Oxc
    const rows = produtos.map((produto) => (
        <Table.Tr key={produto.id_produto}>
            <Table.Td>{produto.nome}</Table.Td>
            <Table.Td ta="center">{produto.unidade_medida}</Table.Td>
            <Table.Td ta="center">{produto.estoque_atual.toFixed(3)}</Table.Td>
            <Table.Td ta="center">{produto.estoque_minimo.toFixed(3)}</Table.Td>
            <Table.Td ta="right">R$ {produto.preco_custo_unitario.toFixed(2)}</Table.Td>
            <Table.Td ta="right">R$ {produto.preco_venda.toFixed(2)}</Table.Td>
            <Table.Td ta="center">
                <Button size="xs" onClick={() => handleOpenEntrada(produto)}>
                    Entrada
                </Button>
            </Table.Td>
        </Table.Tr>
    ));


    // ---------------------------------------------------------------------
    // 6. RENDERIZAÇÃO DO COMPONENTE
    // ---------------------------------------------------------------------
    return (
        <AppShellLayout> 
            <Container size="xl" pt="md">
                <Group justify="space-between" mb="lg">
                    <Title order={1}>Gestão de Estoque</Title>
                    <Button onClick={openCadastro}>Novo Produto</Button>
                </Group>
                
                {/* ----------------- DRAWER DE CADASTRO DE PRODUTO ----------------- */}
                <Drawer 
                    opened={cadastroOpened} 
                    onClose={closeCadastro} 
                    title="Cadastrar Novo Produto" 
                    position="right" 
                    size="lg"
                    closeOnClickOutside={!formLoading} 
                >
                    <form onSubmit={handleStore}>
                        <LoadingOverlay visible={formLoading} overlayProps={{ radius: "sm", blur: 2 }} />
                        
                        <TextInput
                            label="Nome do Produto/Insumo"
                            placeholder="Ex: Arroz Agulhinha, Molho Branco"
                            required
                            mb="md"
                            value={formData.nome}
                            onChange={(event) => setFormData(prev => ({ ...prev, nome: event.currentTarget.value }))}
                        />
                        <Select
                            label="Unidade de Medida"
                            placeholder="Selecione ou digite"
                            data={['KG', 'UN', 'LT', 'PCT', 'G', 'ML']}
                            required
                            searchable
                            creatable
                            mb="md"
                            value={formData.unidade_medida}
                            onChange={(value) => setFormData(prev => ({ ...prev, unidade_medida: value || 'UN' }))}
                        />
                        <TextInput
                            label="Estoque Mínimo (Ponto de Alerta)"
                            placeholder="0.00"
                            required
                            mb="md"
                            value={formData.estoque_minimo.toString()} 
                            onChange={(event) => {
                                const value = event.currentTarget.value.replace(',', '.');
                                const numericValue = value === '' ? 0 : parseFloat(value) || 0; 
                                setFormData(prev => ({ ...prev, estoque_minimo: numericValue }));
                            }}
                        />

                        <Checkbox
                            label="Produto Vendável (Será exibido no PDV)"
                            mb="md"
                            checked={formData.is_vendavel}
                            onChange={(event) => setFormData(prev => ({ 
                                ...prev, 
                                is_vendavel: event.currentTarget.checked, 
                                preco_venda: event.currentTarget.checked ? prev.preco_venda : 0 
                            }))}
                        />

                        {/* NOVO CAMPO: Preço de Venda (Condicional) */}
                        {formData.is_vendavel && (
                            <TextInput
                                label="Preço de Venda (R$) - Para PDV/BI"
                                placeholder="0.00"
                                required
                                mb="md"
                                value={formData.preco_venda.toString()}
                                onChange={(event) => {
                                    const value = event.currentTarget.value.replace(',', '.');
                                    const numericValue = value === '' ? 0 : parseFloat(value) || 0; 
                                    setFormData(prev => ({ ...prev, preco_venda: numericValue }));
                                }}
                            />
                        )}
                        <Checkbox
                            label="Produto Pré-Pronto (Utilizado em Fichas Técnicas como intermediário)"
                            mb="xl"
                            checked={formData.is_pre_pronto}
                            onChange={(event) => setFormData(prev => ({ ...prev, is_pre_pronto: event.currentTarget.checked }))}
                        />

                        <Button type="submit" loading={formLoading}>
                            Cadastrar Produto
                        </Button>
                    </form>
                </Drawer>

                {/* ----------------- DRAWER DE ENTRADA DE ESTOQUE ----------------- */}
                <Drawer 
                    opened={entradaOpened} 
                    onClose={closeEntrada} 
                    title={`Entrada de Estoque: ${entradaFormData.nome_produto}`} 
                    position="right" 
                    size="lg"
                >
                    <form onSubmit={handleEntradaEstoque}>
                        <LoadingOverlay visible={entradaFormLoading} overlayProps={{ radius: "sm", blur: 2 }} />
                        <Text mb="md">Produto: **{entradaFormData.nome_produto}** ({entradaFormData.unidade_medida})</Text>

                        <TextInput
                            label={`Quantidade de Entrada (${entradaFormData.unidade_medida})`}
                            placeholder="Ex: 10.5"
                            required
                            mb="md"
                            value={entradaFormData.quantidade.toString()}
                            onChange={(event) => {
                                const value = event.currentTarget.value.replace(',', '.');
                                const numericValue = value === '' ? 0 : parseFloat(value) || 0;
                                setEntradaFormData(prev => ({ ...prev, quantidade: numericValue }));
                            }}
                        />

                        <TextInput
                            label="Custo Unitário da Compra (R$)"
                            placeholder="Ex: 3.50"
                            required
                            mb="md"
                            value={entradaFormData.custo_unitario.toString()}
                            onChange={(event) => {
                                const value = event.currentTarget.value.replace(',', '.');
                                const numericValue = value === '' ? 0 : parseFloat(value) || 0;
                                setEntradaFormData(prev => ({ ...prev, custo_unitario: numericValue }));
                            }}
                        />

                        <Textarea
                            label="Observações (Nota Fiscal, Lote, Fornecedor, etc.)"
                            placeholder="Ex: Recebido da Nota 12345, Lote 2025/JAN"
                            mb="md"
                            value={entradaFormData.observacoes}
                            onChange={(event) => setEntradaFormData(prev => ({ ...prev, observacoes: event.currentTarget.value }))}
                        />

                        <Button type="submit" loading={entradaFormLoading}>
                            Registrar Recebimento
                        </Button>
                    </form>
                </Drawer>

                {/* ----------------- TABELA DE PRODUTOS ----------------- */}
                {loading && <LoadingOverlay visible={loading} />}
                {error && (
                    <Text color="red" ta="center" mt="md">
                        {error}
                    </Text>
                )}

                {!loading && !error && (
                    <Table striped highlightOnHover withTableBorder withColumnBorders>
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Nome</Table.Th>
                                <Table.Th>Medida</Table.Th>
                                <Table.Th>Estoque Atual</Table.Th>
                                <Table.Th>Estoque Mínimo</Table.Th>
                                <Table.Th>Custo (R$)</Table.Th>
                                <Table.Th>Venda (R$)</Table.Th> 
                                <Table.Th>Ações</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rows.length > 0 ? rows : (
                                <Table.Tr><Table.Td colSpan={7} ta="center">Nenhum produto cadastrado.</Table.Td></Table.Tr>
                            )}
                        </Table.Tbody>
                    </Table>
                )}
            </Container>
    </AppShellLayout>
    );
}