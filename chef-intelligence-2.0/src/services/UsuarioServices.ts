// src/services/UsuarioService.ts

// A importação deve ser o modelo default export, como é comum no Sequelize
import Usuario from "../models/Usuario";

export class UsuarioService {
  // Construtor sem dependências externas de Services.
  constructor() {}

  /**
   * R4: Busca o ID da Unidade (Empresa) associada a um usuário.
   */
  public async getUnidadeIdByUsuarioId(
    usuarioId: number
  ): Promise<number | null> {
    // ⚠️ ATENÇÃO: Confirme que seu modelo Usuario.ts exporta a classe 'Usuario' como default export.
    const usuario = await Usuario.findByPk(usuarioId, {
      attributes: ["unidade_id"], // Busca apenas o campo necessário para otimização
    });

    return usuario ? usuario.unidade_id : null;
  }
}
