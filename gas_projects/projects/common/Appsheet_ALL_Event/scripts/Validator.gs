const Validator = {

  validateRequestPayload(params) {

    if (!params) throw new Error("リクエストボディが空です。");

    if (!params.action) throw new Error("必須パラメータ 'action' が不足しています。");


    const { action, eventId, eventData, ownerData } = params;


    switch (action) {

      case 'CREATE':

        if (!eventData) throw new Error("'CREATE'アクションには 'eventData' が必須です。");

        if (!ownerData || !ownerData.newOwnerEmail) throw new Error("'CREATE'アクションには 'ownerData.newOwnerEmail' が必須です。");

        break;


      case 'UPDATE':

        if (!eventId) throw new Error("'UPDATE'アクションには 'eventId' が必須です。");

        if (!eventData) throw new Error("'UPDATE'アクションには 'eventData' が必須です。");

        if (!ownerData || !ownerData.newOwnerEmail) throw new Error("'UPDATE'アクションには 'ownerData.newOwnerEmail' が必須です。");

        break;


      case 'TRANSFER':

        if (!eventId) throw new Error("'TRANSFER'アクションには 'eventId' が必須です。");

        if (!eventData) throw new Error("'TRANSFER'アクションには 'eventData' が必須です。");

        if (!ownerData || !ownerData.oldOwnerEmail || !ownerData.newOwnerEmail) throw new Error("'TRANSFER'アクションには 'ownerData' の 'oldOwnerEmail' と 'newOwnerEmail' が必須です。");

        break;

        
      case 'DELETE':

        if (!eventId) throw new Error("'DELETE'アクションには 'eventId' が必須です。");

        if (!ownerData || !ownerData.oldOwnerEmail) throw new Error("'DELETE'アクションには 'ownerData.oldOwnerEmail' が必須です。");

        break;


      default:

        throw new Error(`未知のアクションです: ${action}`);

    }

  }

};
