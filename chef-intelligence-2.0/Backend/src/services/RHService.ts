import { Op, WhereOptions, ModelCtor } from "sequelize";
import {
  IModelFactory,
  StatusColaborador,
  IPerfilIdeal,
  IHistoricoPerformance,
  NivelAcesso,
} from "../config/types";
import Colaborador, {
  ColaboradorModel,
  ColaboradorCreationAttributes,
  ColaboradorAttributes,
} from "../models/Colaborador"; // Tipagem
import { CargoModel, CargoCreationAttributes } from "../models/Cargo"; // Tipagem

// Usamos as interfaces de modelo (ModelCtor) e as interfaces de atributos (Model)
export class RHService {
  private Colaborador: ModelCtor<ColaboradorModel>;
  private Cargo: ModelCtor<CargoModel>;

  constructor(models: IModelFactory) {
    // 🔑 Injeção dos modelos (GPR-3) - Agora usando ModelCtor
    this.Colaborador = models.Colaborador as ModelCtor<ColaboradorModel>;
    this.Cargo = models.Cargo as ModelCtor<CargoModel>;
  }

  // -------------------------------------------------------------------------
  // Métodos de Colaborador (CRUD com GPR-4)
  // -------------------------------------------------------------------------

  /**
   * @method getColaboradorById
   * @description Busca um colaborador por ID, respeitando a segregação de unidade (GPR-4).
   */
  public async getColaboradorById(
    id_colaborador: number,
    unidade_id: number
  ): Promise<ColaboradorModel | null> {
    // GPR-5: Assincronicidade
    return this.Colaborador.findOne({
      where: {
        id_colaborador,
        unidade_id, // 🔑 GPR-4: Filtro obrigatório por unidade
      },
      // Inclui o Cargo (GPR-3)
      include: [{ model: this.Cargo, as: "cargo" }],
    });
  }

  /**
   * @method getAllColaboradores
   * @description Retorna todos os colaboradores de uma unidade específica (GPR-4).
   */
  public async getAllColaboradores(
    unidade_id: number,
    status?: StatusColaborador,
    nivel_acesso?: NivelAcesso
  ): Promise<ColaboradorModel[]> {
    const whereClause: WhereOptions = { unidade_id }; // 🔑 GPR-4: Filtro obrigatório

    if (status) {
      whereClause.Status = status;
    }
    if (nivel_acesso) {
      whereClause.nivel_acesso = nivel_acesso;
    }

    // GPR-5: Assincronicidade
    return this.Colaborador.findAll({
      where: whereClause,
      include: [{ model: this.Cargo, as: "cargo" }],
      order: [["nome_completo", "ASC"]],
    });
  }

  /**
   * @method createColaborador
   * @description Cria um novo colaborador.
   * Recebe ColaboradorCreationAttributes (dados puros), não o modelo inteiro.
   */
  public async createColaborador(
    data: ColaboradorCreationAttributes
  ): Promise<ColaboradorModel> {
    if (!data.unidade_id) {
      throw new Error(
        "A unidade_id é obrigatória para a criação de um colaborador."
      );
    }
    // GPR-5: Assincronicidade
    return this.Colaborador.create(data);
  }

  /**
   * @method updateColaborador
   * @description Atualiza dados de um colaborador, respeitando a segregação de unidade (GPR-4).
   */
  public async updateColaborador(
    id_colaborador: number,
    unidade_id: number,
    data: Partial<ColaboradorAttributes>
  ): Promise<ColaboradorModel> {
    const colaborador = await this.getColaboradorById(
      id_colaborador,
      unidade_id
    );

    if (!colaborador) {
      throw new Error(
        `Colaborador ID ${id_colaborador} não encontrado na unidade ${unidade_id}.`
      );
    }

    await colaborador.update(data);
    return colaborador;
  }

  /**
   * @method deleteColaborador
   * @description Realiza a exclusão lógica (Status: DESLIGADO) de um colaborador.
   */
  public async deleteColaborador(
    id_colaborador: number,
    unidade_id: number
  ): Promise<void> {
    const colaborador = await this.getColaboradorById(
      id_colaborador,
      unidade_id
    );

    if (!colaborador) {
      throw new Error(
        `Colaborador ID ${id_colaborador} não encontrado na unidade ${unidade_id}.`
      );
    }

    // Exclusão Lógica (GPR-5)
    await colaborador.update({ Status: "DESLIGADO" });
  }

  // -------------------------------------------------------------------------
  // Métodos de Cargo (CRUD com GPR-4)
  // -------------------------------------------------------------------------

  /**
   * @method getCargoById
   * @description Busca um cargo por ID, respeitando a segregação de unidade (GPR-4).
   */
  public async getCargoById(
    id_cargo: number,
    unidade_id: number
  ): Promise<CargoModel | null> {
    return this.Cargo.findOne({
      where: {
        id_cargo,
        unidade_id, // 🔑 GPR-4: Filtro obrigatório por unidade
      },
      include: ["permissoes"],
    });
  }

  /**
   * @method getAllCargos
   * @description Retorna todos os cargos de uma unidade específica (GPR-4).
   */
  public async getAllCargos(unidade_id: number): Promise<CargoModel[]> {
    return this.Cargo.findAll({
      where: { unidade_id }, // 🔑 GPR-4: Filtro obrigatório
      order: [["nome_cargo", "ASC"]],
      include: ["permissoes"],
    });
  }

  /**
   * @method createCargo
   * @description Cria um novo cargo.
   * Recebe CargoCreationAttributes (dados puros), não o modelo inteiro.
   */
  public async createCargo(data: CargoCreationAttributes): Promise<CargoModel> {
    if (!data.unidade_id) {
      throw new Error("A unidade_id é obrigatória para a criação de um Cargo.");
    }
    return this.Cargo.create(data);
  }

  /**
   * @method updateCargo
   * @description Atualiza um cargo, respeitando a segregação de unidade (GPR-4).
   */
  public async updateCargo(
    id_cargo: number,
    unidade_id: number,
    data: Partial<CargoModel>
  ): Promise<CargoModel> {
    const cargo = await this.getCargoById(id_cargo, unidade_id);

    if (!cargo) {
      throw new Error(
        `Cargo ID ${id_cargo} não encontrado na unidade ${unidade_id}.`
      );
    }

    if (data.unidade_id && data.unidade_id !== unidade_id) {
      throw new Error(
        "Não é permitido alterar a unidade_id de um cargo existente."
      );
    }

    await cargo.update(data);
    return cargo;
  }

  /**
   * @method deleteCargo
   * @description Exclui um cargo por ID, respeitando a unidade (GPR-4).
   */
  public async deleteCargo(
    id_cargo: number,
    unidade_id: number
  ): Promise<void> {
    const colaboradoresAtivos = await this.Colaborador.count({
      where: {
        cargo_id: id_cargo,
        unidade_id: unidade_id, // GPR-4
        Status: "ATIVO",
      },
    });

    if (colaboradoresAtivos > 0) {
      throw new Error(
        `Não é possível excluir o Cargo ID ${id_cargo}. Há ${colaboradoresAtivos} colaboradores ativos associados a ele.`
      );
    }

    const result = await this.Cargo.destroy({
      where: {
        id_cargo,
        unidade_id, // 🔑 GPR-4: Filtro obrigatório
      },
    });

    if (result === 0) {
      throw new Error(
        `Cargo ID ${id_cargo} não encontrado na unidade ${unidade_id} ou não pôde ser excluído.`
      );
    }
  }

  // -------------------------------------------------------------------------
  // Métodos Complexos de RH (Stubs exigidos pelo Controller)
  // -------------------------------------------------------------------------

  /**
   * @method definirPerfilIdeal
   * @description Lógica para definir Perfil Ideal (exigido pelo RHController).
   */
  public async definirPerfilIdeal(perfil: IPerfilIdeal): Promise<void> {
    console.log(
      `GPR-3: Lógica para definir Perfil Ideal para Cargo ${perfil.cargo_id}.`
    );
    // ⚠️ IMPLEMENTAÇÃO FUTURA
    return;
  }

  /**
   * @method registrarPerformance
   * @description Lógica para registrar uma avaliação de performance (exigido pelo RHController).
   */
  public async registrarPerformance(
    performance: IHistoricoPerformance
  ): Promise<void> {
    console.log(
      `GPR-3: Lógica para registrar performance para Colaborador ${performance.colaborador_id}.`
    );
    // ⚠️ IMPLEMENTAÇÃO FUTURA
    return;
  }

  /**
   * @method calcularSalarioBruto
   * @description Lógica de cálculo do salário bruto, usando dados do Cargo e Folha de Pagamento.
   */
  public async calcularSalarioBruto(
    id_colaborador: number,
    unidade_id: number,
    mesAno: Date
  ): Promise<number> {
    const colaborador = await this.getColaboradorById(
      id_colaborador,
      unidade_id
    );

    if (!colaborador || !colaborador.cargo) {
      throw new Error("Colaborador ou Cargo não encontrado para cálculo.");
    }

    const salarioBase = colaborador.cargo.salario_base || 0; // Provide a default value
    let salarioBruto = salarioBase;

    // Lógica GPR-3: Adicionar cálculos de Horas Extras, Adicionais, etc.
    const horasExtras = 0; // Placeholder
    salarioBruto += horasExtras;

    return salarioBruto;
  }
}
