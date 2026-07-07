/**
 * BoardEditor - компонент совместной доски Excalidraw с синхронизацией через Yjs
 *
 * Реализует двусторонний binding между сценой Excalidraw и Y.Map:
 * 1. Элементы сцены хранятся в Y.Map по element.id
 * 2. Локальные изменения → Yjs: onChange записывает новые/изменённые элементы
 * 3. Yjs → локальные: yMap.observe обновляет сцену через reconcileElements
 * 4. Курсоры: onPointerUpdate → awareness; awareness.change → collaborators
 *
 * Важно: бинарные файлы (картинки) в v1 НЕ синхронизируются (TODO)
 *
 * Использование:
 * <BoardProvider boardId={1}>
 *   <BoardEditor />
 * </BoardProvider>
 */

import { useCallback, useEffect, useRef } from 'react'
import { Excalidraw, MainMenu, reconcileElements } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/types'
import type { ExcalidrawElement, OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile'
import * as Y from 'yjs'
import { useBoard } from '../providers/BoardProvider'
import { SearchIcon } from '../workspace/icons'
import '@excalidraw/excalidraw/index.css'

// Origin-объект для транзакций Yjs, чтобы отличать наши изменения от внешних
const EXCALIDRAW_ORIGIN = { origin: 'excalidraw-binding' }

export function BoardEditor() {
  const { doc, awareness, connect, disconnect, username, cursorColor } = useBoard()
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null)

  // Y.Map для хранения элементов сцены по element.id
  const yMapRef = useRef<Y.Map<Record<string, unknown>> | null>(null)

  // Применяет текущее содержимое Y.Map к сцене Excalidraw (reconcile с локальными).
  // Вызывается и из observe (внешние апдейты), и при готовности API — иначе элементы,
  // пришедшие по сети до маунта Excalidraw, потерялись бы (гонка холодного старта).
  const applyRemoteToScene = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      const yMap = doc.getMap<Record<string, unknown>>('elements')
      const localElements = api.getSceneElementsIncludingDeleted()

      // Собираем массив элементов из Y.Map
      const remoteElements: OrderedExcalidrawElement[] = []
      yMap.forEach((value) => {
        if (value && typeof value === 'object' && 'id' in value) {
          remoteElements.push(value as unknown as OrderedExcalidrawElement)
        }
      })

      // Сортируем по fractional index (z-order)
      remoteElements.sort((a, b) => {
        const aIndex = a.index ?? ''
        const bIndex = b.index ?? ''
        return aIndex.localeCompare(bIndex)
      })

      // Reconcile: merge local и remote с сохранением порядка.
      // RemoteExcalidrawElement — это OrderedExcalidrawElement с брендом, приводим через unknown.
      // ВАЖНО: передаём реальный appState (не пустой). По нему reconcileElements определяет,
      // какой элемент пользователь сейчас рисует/ресайзит/тащит, и НЕ затирает его удалённой
      // версией. С пустым appState активный элемент сбрасывался до версии из Y.Map — отсюда
      // «квадрат схлопывается до меньшего размера» и «линия обрывается на середине».
      const reconciled = reconcileElements(
        localElements,
        remoteElements as unknown as readonly RemoteExcalidrawElement[],
        api.getAppState(),
      )

      api.updateScene({ elements: reconciled })
    },
    [doc],
  )

  // Инициализация Y.Map и подписок
  useEffect(() => {
    const yMap = doc.getMap<Record<string, unknown>>('elements')
    yMapRef.current = yMap

    // Пересборка сцены (reconcile + updateScene) — тяжёлая; при быстрой серии чужих апдейтов
    // делать её на каждый апдейт нельзя: получатель захлёбывается, его приёмный буфер тормозит
    // сервер (backpressure), и апдейты выливаются пачкой. Коалесим серию апдейтов за один кадр
    // в одну пересборку через requestAnimationFrame — сцена всё равно строится из полного Y.Map.
    let rafId: number | null = null
    const flush = () => {
      rafId = null
      const api = excalidrawAPIRef.current
      if (api) applyRemoteToScene(api)
    }

    // Подписка на изменения из Yjs → обновление сцены Excalidraw
    const observeHandler = (event: Y.YMapEvent<Record<string, unknown>>) => {
      // Игнорируем изменения, которые мы сами инициировали
      if (event.transaction.origin === EXCALIDRAW_ORIGIN) return
      if (!excalidrawAPIRef.current) return
      if (rafId == null) rafId = requestAnimationFrame(flush)
    }

    yMap.observe(observeHandler)

    // Подключение к серверу
    connect()

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      yMap.unobserve(observeHandler)
      disconnect()
    }
  }, [doc, connect, disconnect, applyRemoteToScene])

  // Подписка на awareness (курсоры)
  useEffect(() => {
    // Установка локального состояния awareness (имя, цвет)
    awareness.setLocalStateField('user', {
      name: username,
      color: cursorColor,
    })

    const changeHandler = () => {
      if (!excalidrawAPIRef.current) return

      const states = awareness.getStates()
      const collaborators: AppState['collaborators'] = new Map()

      states.forEach((state, clientId) => {
        if (clientId === doc.clientID) return // своя вкладка
        // Каждая вкладка — отдельный Yjs-клиент со своим clientID, поэтому другие вкладки
        // ТОГО ЖE аккаунта прилетают как «участники». Не показываем курсоры своего аккаунта
        // (сравниваем по имени = email пользователя).
        if (state.user?.name === username) return
        if (state.user) {
          collaborators.set(clientId.toString() as AppState['collaborators'] extends Map<infer K, unknown> ? K : never, {
            username: state.user.name,
            color: state.user.color,
            pointer: state.pointer,
            button: state.pointer?.button ?? 'up',
            selectedElementIds: state.selectedElementIds,
          })
        }
      })

      // collaborators — отдельный параметр updateScene верхнего уровня (НЕ внутри appState).
      // Через appState карта не заменялась целиком, и убранный курсор своей вкладки оставался.
      excalidrawAPIRef.current.updateScene({ collaborators })
    }

    awareness.on('change', changeHandler)

    return () => {
      awareness.off('change', changeHandler)
    }
  }, [awareness, doc.clientID, username, cursorColor])

  // Обработчик изменений сцены Excalidraw → Yjs
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      if (!yMapRef.current) return

      // TODO: v2 - синхронизация бинарных файлов (вставленные картинки)
      // Нужно использовать Y.Map для files и обрабатывать BinaryFiles из onChange
      // Также потребуется загрузка файлов при инициализации из Y.Map

      doc.transact(() => {
        const yMap = yMapRef.current!
        const currentElementIds = new Set<string>()

        // Собираем ID элементов, которые были в Y.Map
        yMap.forEach((_, id) => currentElementIds.add(id as string))

        // Обновляем/добавляем элементы
        for (const element of elements) {
          const existingRaw = yMap.get(element.id)
          const existing = existingRaw as unknown as ExcalidrawElement | undefined

          // Записываем только если версия изменилась (или элемент новый).
          if (!existing || existing.version !== element.version) {
            // ВАЖНО: кладём глубокую копию, а не сам объект элемента. Excalidraw переиспользует
            // и мутирует элемент на месте во время рисования; если хранить живую ссылку, то
            // yMap.get вернёт её же с уже обновлённой version, сравнение version === version
            // окажется истинным, и промежуточные кадры линии не запишутся и не разойдутся —
            // у других участников элемент застынет на первом снимке (точке старта).
            yMap.set(element.id, structuredClone(element) as unknown as Record<string, unknown>)
          }

          currentElementIds.delete(element.id)
        }

        // Удаляем исчезнувшие элементы
        for (const id of currentElementIds) {
          yMap.delete(id)
        }
      }, EXCALIDRAW_ORIGIN)
    },
    [doc],
  )

  // Обработчик позиции курсора → awareness.
  // Троттлим до ~20 Гц: onPointerUpdate стреляет на каждый mousemove, а каждый апдект
  // рассылается остальным и у них дёргает updateScene(collaborators). Без троттла поток
  // курсора флудит соединение и конкурирует с апдейтами рисунка.
  const lastPointerSentRef = useRef(0)
  const handlePointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number; tool: 'pointer' | 'laser' }; button: 'up' | 'down' }) => {
      const now = performance.now()
      if (now - lastPointerSentRef.current < 50) return
      lastPointerSentRef.current = now
      awareness.setLocalStateField('pointer', {
        x: payload.pointer.x,
        y: payload.pointer.y,
        tool: payload.pointer.tool,
        button: payload.button,
      })
    },
    [awareness],
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Excalidraw
        excalidrawAPI={(api) => {
          excalidrawAPIRef.current = api
          // Красим сцену тем, что уже успело прийти по сети до готовности API.
          applyRemoteToScene(api)
        }}
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        isCollaborating
        langCode="ru-RU"
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: false,
            saveToActiveFile: false,
          },
        }}
      >
        {/* Кастомное меню заменяет дефолтное целиком, поэтому повторяем все стандартные
            пункты в том же порядке — но БЕЗ блока «Excalidraw links» (Socials). */}
        <MainMenu>
          <MainMenu.DefaultItems.SaveAsImage />
          {/* Свой пункт с русской подписью вместо DefaultItems.SearchMenu (у Excalidraw нет
              ru-перевода для «Find on canvas»). Внутри поиск — это таб "search" дефолтного
              сайдбара (name "default"); штатный экшен searchMenu открывает именно его. Делаем
              то же самое публичным методом toggleSidebar — без эмуляции горячей клавиши. */}
          <MainMenu.Item
            icon={<SearchIcon size={16} />}
            shortcut="Ctrl+F"
            onSelect={() => excalidrawAPIRef.current?.toggleSidebar({ name: 'default', tab: 'search' })}
          >
            Найти на холсте
          </MainMenu.Item>
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
      </Excalidraw>
    </div>
  )
}
