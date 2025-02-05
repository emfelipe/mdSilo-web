import { useMemo, useState, useCallback, useEffect } from 'react';
import { Editor, Range, Transforms } from 'slate';
import { useSlate } from 'slate-react';
import type { TablerIcon } from '@tabler/icons';
import { insertTag } from 'editor/formatting';
import { deleteText } from 'editor/transforms';
import useTagSearch from 'editor/hooks/useTagSearch';
import useDebounce from 'editor/hooks/useDebounce';
import EditorPopover from '../EditorPopover';

const TAG_REGEX = /(?:^|\s)(#)([^\s]+)/; // ` #hashtag `
const DEBOUNCE_MS = 100;

enum OptionType {
  TAG,
}

type Option = {
  type: OptionType;
  name: string;
  icon?: TablerIcon;
};

export default function HashTagAutocompletePopover() {
  const editor = useSlate();

  const [isVisible, setIsVisible] = useState(false);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);

  const [regexResult, setRegexResult] = useState<RegExpMatchArray | null>(null);

  const inputText = useMemo(() => {
    if (!regexResult) {
      return '';
    } else {
      return regexResult[2];
    }
  }, [regexResult]);
  const [tagText] = useDebounce(inputText, DEBOUNCE_MS);

  const search = useTagSearch({ numOfResults: 10 });
  const searchResults = useMemo(() => search(tagText), [search, tagText]);

  const options = useMemo(
    () =>
      searchResults.map((result) => ({
        type: OptionType.TAG,
        name: result.item,
      })),
    [searchResults]
  );

  const hidePopover = useCallback(() => {
    setIsVisible(false);
    setRegexResult(null);
    setSelectedOptionIndex(0);
  }, []);

  const getRegexResult = useCallback(() => {
    const { selection } = editor;

    if (!selection || !Range.isCollapsed(selection)) {
      return null;
    }

    try {
      const { anchor } = selection;

      const elementStart = Editor.start(editor, anchor.path);
      const elementRange = { anchor, focus: elementStart };
      const elementText = Editor.string(editor, elementRange);

      return elementText.match(TAG_REGEX);
    } catch (e) {
      return null;
    }
  }, [editor]);

  useEffect(() => {
    const result = getRegexResult();

    if (!result) {
      hidePopover();
      return;
    }

    setRegexResult(result);
    setIsVisible(true);
  }, [editor.children, getRegexResult, hidePopover]);

  const onOptionClick = useCallback(
    async (option?: Option) => {
      if (!option || !regexResult || !editor.selection) {
        return;
      }

      // Delete markdown text
      const { path: selectionPath, offset: endOfSelection } =
        editor.selection.anchor;

      const [, startMark, tagName] = regexResult;
      const lengthToDelete = startMark.length + tagName.length;

      deleteText(editor, selectionPath, endOfSelection, lengthToDelete);

      // Handle inserting tag
      if (option.type === OptionType.TAG) {
        insertTag(editor, option.name);
        Transforms.move(editor, { distance: 1, unit: 'offset' }); // Focus after the tag
      } else {
        throw new Error(`Option type ${option.type} is not supported`);
      }

      hidePopover();
    },
    [editor, hidePopover, regexResult]
  );

  const onKeyDown = useCallback(
    (event) => {
      // Update the selected option based on arrow key input
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedOptionIndex((index) => {
          return index <= 0 ? options.length - 1 : index - 1;
        });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedOptionIndex((index) => {
          return index >= options.length - 1 ? 0 : index + 1;
        });
      } else if (event.key === 'Enter') {
        // We need both preventDefault and stopPropagation to prevent an enter being added
        event.preventDefault();
        event.stopPropagation();
        onOptionClick(options[selectedOptionIndex]);
      }
    },
    [onOptionClick, options, selectedOptionIndex]
  );

  useEffect(() => {
    if (isVisible && options.length > 0) {
      document.addEventListener('keydown', onKeyDown, true);

      return () => {
        document.removeEventListener('keydown', onKeyDown, true);
      };
    }
  }, [isVisible, onKeyDown, options.length]);

  return isVisible && options.length > 0 ? (
    <EditorPopover
      placement="bottom"
      className="flex flex-col w-auto"
      onClose={hidePopover}
    >
      {options.map((option, index) => (
        <OptionItem
          key={option.name}
          option={option}
          isSelected={index === selectedOptionIndex}
          onClick={() => onOptionClick(option)}
        />
      ))}
    </EditorPopover>
  ) : null;
}

type OptionProps = {
  option: Option;
  isSelected: boolean;
  onClick: () => void;
};

const OptionItem = (props: OptionProps) => {
  const { option, isSelected, onClick } = props;
  return (
    <div
      className={`flex flex-row items-center px-4 py-1 cursor-pointer text-gray-800 hover:bg-gray-100 active:bg-gray-200 dark:text-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600 ${
        isSelected ? 'bg-gray-100 dark:bg-gray-700' : ''
      }`}
      onPointerDown={(event) => event.preventDefault()}
      onPointerUp={(event) => {
        if (event.button === 0) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {option.icon ? (
        <option.icon size={18} className="flex-shrink-0 mr-1" />
      ) : null}
      <span className="overflow-hidden overflow-ellipsis whitespace-nowrap">
        #{option.name}
      </span>
    </div>
  );
};
